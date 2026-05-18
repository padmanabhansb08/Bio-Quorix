/**
 * @module FocusMonitor
 * Client-side calculation engine for real-time student attention tracking.
 * Translated and optimized from standard Python/OpenCV MediaPipe + YOLOv8 scripts.
 * 
 * Tracks:
 * 1. Drowsiness (via Eye Aspect Ratio - EAR)
 * 2. Distraction (via head turn pose deviation)
 * 3. Speaking (via Mouth Aspect Ratio - MAR)
 * 4. Phone Usage (via TensorFlow.js COCO-SSD object detection)
 * 5. Student Absence (via Face Detection presence)
 * 
 * Provides:
 * - Native Web Audio synthesized beep alerts
 * - Native Web Speech API Speech Synthesis vocal warnings (for blind tutors)
 * - Automatic background logging to SQLite DB via /api/attention endpoints
 * - Premium Canvas HUD visualization overlay
 */

window.FocusMonitor = {
    // Configurable thresholds matching the Python script logic
    settings: {
        // EAR threshold raised to 0.30 from 0.25 — face-api.js TinyFaceDetector 68-point model
        // produces higher EAR values for closed eyes compared to MediaPipe's 478-point mesh.
        // Python reference: EAR_THRESHOLD = 0.25 (MediaPipe). Equivalent for face-api = 0.30.
        earThreshold: 0.30,
        marThreshold: 0.15,        // Mouth Aspect Ratio above this flags speaking
        // drowsyMinFrames reduced to 8 — loop runs at 10fps, so 8 frames = ~0.8s.
        // Python reference: DROWSY_FRAMES = 20 at 30fps = ~0.67s. Now equivalent.
        drowsyMinFrames: 8,
        // distractedMinFrames reduced to 8 — same reasoning as drowsyMinFrames.
        distractedMinFrames: 8,
        absentMinFrames: 20,       // Consec frames of no face to trigger absent (~2.0s)
        speakingMinFrames: 10,     // Consec frames of open mouth to trigger speaking
        soundAlertsEnabled: true,  // Web Audio alert sound
        voiceAlertsEnabled: true,  // Web Speech vocal alerts (for blind tutors)
        alertInterval: 5000        // Min ms between voice alerts to protect ears
    },

    // Session State tracking
    state: {
        sessionId: null,
        active: false,
        startTime: null,
        durationSeconds: 0,
        attentivenessHistory: [],
        currentAttentiveness: 100,
        
        // Counter tallies for end session API payload
        drowsyCount: 0,
        distractionCount: 0,
        phoneCount: 0,
        absenceCount: 0,

        // Live metrics
        ear: 0.30,
        mar: 0.05,
        noseOffset: 0.50,
        currentStatus: 'attentive', // 'attentive' | 'drowsy' | 'distracted' | 'phone_usage' | 'absent' | 'speaking'
        
        // Consecutive frame registers
        drowsyFrameStreak: 0,
        distractedFrameStreak: 0,
        speakingFrameStreak: 0,
        absentFrameStreak: 0
    },

    // Resources & instances
    resources: {
        video: null,
        canvas: null,
        ctx: null,
        cocoModel: null,
        stream: null,
        intervalId: null,
        objectIntervalId: null,
        timerIntervalId: null,
        modelsLoaded: false
    },

    // Throttle helper
    lastSpeechTime: 0,
    logs: [], // Timeline audits for visual listing

    /**
     * Initializes the models (face-api and COCO-SSD)
     */
    async init(videoElement, canvasElement, statusCallback) {
        this.resources.video = videoElement;
        this.resources.canvas = canvasElement;
        if (canvasElement) {
            this.resources.ctx = canvasElement.getContext('2d');
        }

        if (this.resources.modelsLoaded) {
            if (statusCallback) statusCallback("AI Models ready.");
            return true;
        }

        try {
            if (statusCallback) statusCallback("Loading facial mapping models...");
            
            // Load face landmark model (Face Mesh equivalent in face-api.js)
            if (window.faceapi) {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/'),
                    faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/')
                ]);
            } else {
                throw new Error("face-api.js script is not loaded in the window.");
            }

            if (statusCallback) statusCallback("Loading neural object detector...");
            
            // Load TensorFlow COCO-SSD for phone detection (YOLOv8 equivalent)
            if (window.cocoSsd) {
                this.resources.cocoModel = await cocoSsd.load();
            } else {
                console.warn("TensorFlow COCO-SSD not loaded, phone detection will be disabled.");
            }

            this.resources.modelsLoaded = true;
            if (statusCallback) statusCallback("All AI Neural nodes loaded.");
            return true;
        } catch (err) {
            console.error("[FocusMonitor] Model load error:", err);
            if (statusCallback) statusCallback("Failed to initialize models: " + err.message);
            return false;
        }
    },

    /**
     * Synthesizes audio beep alerts natively via Web Audio API
     */
    playAudioAlert(frequency = 600, duration = 0.2) {
        if (!this.settings.soundAlertsEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, ctx.currentTime);
            gain.gain.setValueAtTime(0.08, ctx.currentTime); // keep volume low
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (err) {
            console.error("[FocusMonitor] Play sound error:", err);
        }
    },

    /**
     * Speaks vocal alert warning safely with rate limiting to support blind tutors
     */
    speakAlert(text) {
        if (!this.settings.voiceAlertsEnabled) return;
        const now = Date.now();
        if (now - this.lastSpeechTime < this.settings.alertInterval) return; // rate limit speech
        this.lastSpeechTime = now;
        
        try {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel(); // clear previous alerts to read instantly
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.05; // slightly faster pace
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        } catch (err) {
            console.error("[FocusMonitor] TTS speech error:", err);
        }
    },

    /**
     * Logs real-time events to the session audit timeline
     */
    addLog(type, details) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const logEntry = { timestamp, type, details };
        this.logs.unshift(logEntry); // new logs first

        // Keep UI log feed length clean
        if (this.logs.length > 50) this.logs.pop();

        // Trigger local view updates if element exists
        const logContainer = document.getElementById('focusLogTimeline');
        if (logContainer) {
            let iconClass = 'info';
            let bgClass = 'bg-info';
            if (type === 'drowsy') { iconClass = 'alert-triangle'; bgClass = 'bg-error'; }
            else if (type === 'distraction') { iconClass = 'shield-alert'; bgClass = 'bg-warning'; }
            else if (type === 'phone_usage') { iconClass = 'smartphone'; bgClass = 'bg-error'; }
            else if (type === 'absent') { iconClass = 'user-minus'; bgClass = 'bg-warning'; }
            else if (type === 'attentive_return') { iconClass = 'check'; bgClass = 'bg-success'; }

            const logHtml = `
                <div class="log-item" style="display:flex; align-items:center; gap:12px; padding:10px 14px; border-bottom:1px solid var(--border-color); animation: fadeIn 0.3s ease;">
                    <div style="font-family:'JetBrains Mono', monospace; font-size:0.8rem; color:var(--text-secondary); min-width:70px;">${timestamp}</div>
                    <div class="status-indicator ${bgClass}" style="width:8px; height:8px; border-radius:50%;"></div>
                    <div style="font-size:0.9rem; font-weight:500; flex-grow:1; color:var(--text-primary);">${details}</div>
                </div>
            `;
            logContainer.insertAdjacentHTML('afterbegin', logHtml);
        }

        // POST to backend API
        if (this.state.active && this.state.sessionId) {
            this.postEventToBackend(type, details);
        }
    },

    /**
     * Network integration: logs breaches straight to Express SQLite
     */
    async postEventToBackend(eventType, details) {
        try {
            const token = localStorage.getItem('bionexus_token');
            if (!token) return;

            await fetch(`${window.location.origin}/api/attention/session/event`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: this.state.sessionId,
                    eventType,
                    details
                })
            });
        } catch (err) {
            console.error("[FocusMonitor] Network fail posting breach event:", err);
        }
    },

    /**
     * Starts the webcam capture feed
     */
    async startWebcam() {
        try {
            if (this.resources.stream) return true;
            
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user"
                },
                audio: false
            };

            this.resources.stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (this.resources.video) {
                this.resources.video.srcObject = this.resources.stream;
                this.resources.video.setAttribute('playsinline', true);
                await this.resources.video.play();
            }
            return true;
        } catch (err) {
            console.error("[FocusMonitor] Webcam access error:", err);
            this.speakAlert("Webcam access denied. Please allow camera permissions to start focus tracking.");
            return false;
        }
    },

    /**
     * Stops the webcam capture feed
     */
    stopWebcam() {
        if (this.resources.stream) {
            try {
                this.resources.stream.getTracks().forEach(track => track.stop());
            } catch (e) {
                console.error(e);
            }
            this.resources.stream = null;
        }
        if (this.resources.video) {
            this.resources.video.srcObject = null;
        }
    },

    /**
     * Start the entire focus session and database integration
     */
    async startSession() {
        if (this.state.active) return;

        const token = localStorage.getItem('bionexus_token');
        if (!token) {
            this.speakAlert("Please log in first to record study sessions.");
            return;
        }

        const cameraStarted = await this.startWebcam();
        if (!cameraStarted) return;

        try {
            // 1. Handshake with backend database to initialize focus record
            const response = await fetch(`${window.location.origin}/api/attention/session/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'API call failed');
            }

            // 2. Clear state variables
            this.state.sessionId = data.sessionId;
            this.state.active = true;
            this.state.startTime = new Date();
            this.state.durationSeconds = 0;
            this.state.attentivenessHistory = [];
            this.state.currentAttentiveness = 100;
            this.state.drowsyCount = 0;
            this.state.distractionCount = 0;
            this.state.phoneCount = 0;
            this.state.absenceCount = 0;
            this.state.currentStatus = 'attentive';
            
            this.state.drowsyFrameStreak = 0;
            this.state.distractedFrameStreak = 0;
            this.state.speakingFrameStreak = 0;
            this.state.absentFrameStreak = 0;

            this.logs = [];
            const logTimeline = document.getElementById('focusLogTimeline');
            if (logTimeline) logTimeline.innerHTML = '';

            this.addLog('attentive_return', 'Tutor session started. AI tracking active.');
            this.speakAlert("AI Focus Session successfully initiated. Face tracking initialized.");

            // 3. Fire calculations loops
            this.startProcessingLoops();

            // 4. Update UI toggles
            this.updateUiState();
        } catch (err) {
            console.error("[FocusMonitor] Start session error:", err);
            this.speakAlert("Failed to start session. Database server error.");
        }
    },

    /**
     * Stop the focus session, finalize analytics averages, and claim XP
     */
    async stopSession() {
        if (!this.state.active) return;

        this.state.active = false;
        
        // Stop tracking cycles
        if (this.resources.intervalId) clearInterval(this.resources.intervalId);
        if (this.resources.objectIntervalId) clearInterval(this.resources.objectIntervalId);
        if (this.resources.timerIntervalId) clearInterval(this.resources.timerIntervalId);
        
        this.stopWebcam();

        const token = localStorage.getItem('bionexus_token');
        if (!token) return;

        const duration = this.state.durationSeconds;
        const sumScore = this.state.attentivenessHistory.reduce((a, b) => a + b, 0);
        const avgAttentiveness = this.state.attentivenessHistory.length > 0 
            ? Math.round(sumScore / this.state.attentivenessHistory.length) 
            : 100;

        try {
            // POST session totals and updates user progress XP
            const response = await fetch(`${window.location.origin}/api/attention/session/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: this.state.sessionId,
                    durationSeconds: duration,
                    avgAttentiveness: avgAttentiveness,
                    drowsyCount: this.state.drowsyCount,
                    distractionCount: this.state.distractionCount,
                    phoneCount: this.state.phoneCount,
                    absenceCount: this.state.absenceCount
                })
            });

            const data = await response.json();
            
            // Audio-spoken completion feedback showing master results
            this.speakAlert(`Focus Session complete. Focused for ${Math.round(duration / 60) || 1} minutes with ${avgAttentiveness} percent attentiveness. You earned ${data.xpEarned || 0} learn experience points!`);
            this.playAudioAlert(800, 0.4);

            // Clean UI canvas overlay
            if (this.resources.ctx && this.resources.canvas) {
                this.resources.ctx.clearRect(0, 0, this.resources.canvas.width, this.resources.canvas.height);
            }

            // Refresh recent sessions lists & stats
            if (typeof window.loadFocusSessionsList === 'function') {
                window.loadFocusSessionsList();
            }
            if (typeof window.loadFocusAnalytics === 'function') {
                window.loadFocusAnalytics();
            }
            if (typeof window.updateDashboardData === 'function') {
                window.updateDashboardData();
            }

            this.updateUiState();
        } catch (err) {
            console.error("[FocusMonitor] Stop session database log error:", err);
        }
    },

    /**
     * Start timer trackers, face tracking, and object tracking intervals
     */
    startProcessingLoops() {
        // Core face mesh calculations: 10fps (every 100ms) for high reactivity and low cpu usage
        this.resources.intervalId = setInterval(() => {
            this.processFaceFrame();
        }, 100);

        // Object (phone) detection: every 500ms to avoid blocking CPU
        this.resources.objectIntervalId = setInterval(() => {
            this.processObjectFrame();
        }, 500);

        // Time tracking: every second
        this.resources.timerIntervalId = setInterval(() => {
            this.state.durationSeconds++;
            
            // Periodically evaluate & append current attentiveness score history
            this.state.attentivenessHistory.push(this.state.currentAttentiveness);

            // Attentiveness recovery over time
            if (this.state.currentStatus === 'attentive' && this.state.currentAttentiveness < 100) {
                this.state.currentAttentiveness = Math.min(100, this.state.currentAttentiveness + 3);
            }

            // Sync visual clocks on view
            const timerEl = document.getElementById('focusSessionTimer');
            if (timerEl) {
                const mins = Math.floor(this.state.durationSeconds / 60).toString().padStart(2, '0');
                const secs = (this.state.durationSeconds % 60).toString().padStart(2, '0');
                timerEl.textContent = `${mins}:${secs}`;
            }

            // Sync score indicator dials
            const scoreDial = document.getElementById('liveAttentivenessScore');
            const scoreLabel = document.getElementById('liveAttentivenessLabel');
            if (scoreDial) {
                scoreDial.style.strokeDashoffset = 314 - (314 * this.state.currentAttentiveness) / 100;
                if (scoreLabel) scoreLabel.textContent = `${this.state.currentAttentiveness}%`;
            }
        }, 1000);
    },

    /**
     * Main MediaPipe face landmarks extraction and state processing
     */
    async processFaceFrame() {
        if (!this.state.active || !this.resources.video || !this.resources.canvas) return;

        const video = this.resources.video;
        const canvas = this.resources.canvas;
        const ctx = this.resources.ctx;

        // Sync visual resolution matches
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        try {
            // Run Face Detection with landmarks
            const detection = await faceapi.detectSingleFace(
                video,
                // scoreThreshold lowered to 0.3 for better detection in varied lighting
                new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
            ).withFaceLandmarks();

            // Handle Absence breaches
            if (!detection) {
                this.state.absentFrameStreak++;
                
                if (this.state.absentFrameStreak >= this.settings.absentMinFrames) {
                    if (this.state.currentStatus !== 'absent') {
                        this.state.currentStatus = 'absent';
                        this.state.absenceCount++;
                        this.state.currentAttentiveness = Math.max(10, this.state.currentAttentiveness - 25);
                        this.addLog('absent', 'Warning: Tutor not present at workspace.');
                        this.playAudioAlert(400, 0.3);
                    }
                    this.speakAlert("Attention Alert: No student detected in camera viewport!");
                }

                // Render red absence text on overlay
                ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
                ctx.font = "bold 20px 'Plus Jakarta Sans', sans-serif";
                ctx.fillText("⚠️ VISUAL SENSOR DISCONNECTED", 20, 40);
                
                this.updateGaugeIndicators();
                return;
            }

            // Student is present
            this.state.absentFrameStreak = 0;
            if (this.state.currentStatus === 'absent') {
                this.state.currentStatus = 'attentive';
                this.addLog('attentive_return', 'Student returned to workspace.');
                this.speakAlert("Welcome back! Face tracking reestablished.");
            }

            // Extract landmark sets
            const landmarks = detection.landmarks;
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            const mouth = landmarks.getMouth();
            const nose = landmarks.getNose();
            const jaw = landmarks.getJawOutline();

            // 1. EAR Drowsiness Logic
            const earDistance = (p1, p2) => Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
            const calculateEAR = (eye) => {
                const p1 = eye[0], p2 = eye[1], p3 = eye[2], p4 = eye[3], p5 = eye[4], p6 = eye[5];
                return (earDistance(p2, p6) + earDistance(p3, p5)) / (2.0 * earDistance(p1, p4));
            };

            const leftEAR = calculateEAR(leftEye);
            const rightEAR = calculateEAR(rightEye);
            const avgEAR = (leftEAR + rightEAR) / 2.0;
            this.state.ear = avgEAR;

            // Debug: log EAR values every 5 frames to browser console for threshold tuning
            if (this.state.drowsyFrameStreak % 5 === 0 || avgEAR < this.settings.earThreshold) {
                console.debug(`[FocusMonitor] EAR=${avgEAR.toFixed(4)} L=${leftEAR.toFixed(4)} R=${rightEAR.toFixed(4)} streak=${this.state.drowsyFrameStreak}/${this.settings.drowsyMinFrames} threshold=${this.settings.earThreshold}`);
            }

            if (avgEAR < this.settings.earThreshold) {
                this.state.drowsyFrameStreak++;
                if (this.state.drowsyFrameStreak >= this.settings.drowsyMinFrames) {
                    if (this.state.currentStatus !== 'drowsy') {
                        this.state.currentStatus = 'drowsy';
                        this.state.drowsyCount++;
                        this.state.currentAttentiveness = Math.max(10, this.state.currentAttentiveness - 20);
                        this.addLog('drowsy', 'Drowsiness Alert: Student closed eyes for prolonged period.');
                        this.playAudioAlert(520, 0.45);
                    }
                    this.speakAlert("Focus breach! Wake up! You are showing signs of drowsiness.");
                }
            } else {
                this.state.drowsyFrameStreak = 0;
                if (this.state.currentStatus === 'drowsy') {
                    this.state.currentStatus = 'attentive';
                    this.addLog('attentive_return', 'Student is awake and attentive.');
                }
            }

            // 2. Head turn Pose (Distraction) logic
            const noseTip = nose[3];
            const leftCheek = jaw[0];
            const rightCheek = jaw[16];
            const faceWidth = rightCheek.x - leftCheek.x;
            const noseOffset = (noseTip.x - leftCheek.x) / faceWidth;
            this.state.noseOffset = noseOffset;

            // Offset bounds below 35% or above 65% indicates looking away
            if (noseOffset < 0.35 || noseOffset > 0.65) {
                this.state.distractedFrameStreak++;
                if (this.state.distractedFrameStreak >= this.settings.distractedMinFrames) {
                    if (this.state.currentStatus !== 'distracted') {
                        this.state.currentStatus = 'distracted';
                        this.state.distractionCount++;
                        this.state.currentAttentiveness = Math.max(10, this.state.currentAttentiveness - 15);
                        this.addLog('distraction', 'Distraction Alert: Student turned away from screen.');
                        this.playAudioAlert(580, 0.25);
                    }
                    this.speakAlert("Attention breach! Please look straight at the learning viewport.");
                }
            } else {
                this.state.distractedFrameStreak = 0;
                if (this.state.currentStatus === 'distracted') {
                    this.state.currentStatus = 'attentive';
                    this.addLog('attentive_return', 'Student looking forward again.');
                }
            }

            // 3. Mouth Speak check
            const mouthWidth = earDistance(mouth[0], mouth[6]);
            const mouthHeight = earDistance(mouth[14], mouth[18]);
            const MAR = mouthHeight / mouthWidth;
            this.state.mar = MAR;

            if (MAR > this.settings.marThreshold) {
                this.state.speakingFrameStreak++;
                if (this.state.speakingFrameStreak >= this.settings.speakingMinFrames) {
                    if (this.state.currentStatus === 'attentive') {
                        this.state.currentStatus = 'speaking';
                    }
                }
            } else {
                this.state.speakingFrameStreak = 0;
                if (this.state.currentStatus === 'speaking') {
                    this.state.currentStatus = 'attentive';
                }
            }

            // HUD Overlays Rendering
            this.drawHudOverlay(ctx, detection, avgEAR, noseOffset, MAR);
            
            // Sync dashboard gauges
            this.updateGaugeIndicators();
        } catch (err) {
            console.error("[FocusMonitor] Processing frame error:", err);
        }
    },

    /**
     * COCO-SSD object tracker to catch cell phones (equivalent to YOLOv8)
     */
    async processObjectFrame() {
        if (!this.state.active || !this.resources.cocoModel || !this.resources.video) return;

        try {
            const predictions = await this.resources.cocoModel.detect(this.resources.video);
            
            const cellPhone = predictions.find(p => p.class === 'cell phone' && p.score > 0.45);
            
            if (cellPhone) {
                if (this.state.currentStatus !== 'phone_usage') {
                    this.state.currentStatus = 'phone_usage';
                    this.state.phoneCount++;
                    this.state.currentAttentiveness = Math.max(10, this.state.currentAttentiveness - 30);
                    this.addLog('phone_usage', 'Distraction Alert: Cell phone detected in screen area.');
                    this.playAudioAlert(700, 0.5);
                }
                this.speakAlert("Visual infraction! Please put away your mobile device.");

                // Render phone bounding box overlay
                this.drawPhoneBoundingBox(cellPhone);
            } else {
                if (this.state.currentStatus === 'phone_usage') {
                    this.state.currentStatus = 'attentive';
                    this.addLog('attentive_return', 'Mobile device put down. Student focused.');
                }
            }
        } catch (err) {
            console.error("[FocusMonitor] Phone detection scan error:", err);
        }
    },

    /**
     * Draws beautiful Neon HUD overlays on the canvas
     */
    drawHudOverlay(ctx, detection, EAR, headPose, MAR) {
        const box = detection.detection.box;
        
        // Face boundaries glow
        let statusColor = 'rgba(16, 185, 129, 0.85)'; // Emerald Green
        if (this.state.currentStatus === 'drowsy' || this.state.currentStatus === 'absent' || this.state.currentStatus === 'phone_usage') {
            statusColor = 'rgba(239, 68, 68, 0.85)'; // Red
        } else if (this.state.currentStatus === 'distracted') {
            statusColor = 'rgba(245, 158, 11, 0.85)'; // Amber Warning
        } else if (this.state.currentStatus === 'speaking') {
            statusColor = 'rgba(59, 130, 246, 0.85)'; // Blue
        }

        ctx.strokeStyle = statusColor;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = statusColor;
        
        // Draw Glass border round face box
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        // Reset shadows
        ctx.shadowBlur = 0;

        // Draw Status Chip on top of box
        ctx.fillStyle = statusColor;
        ctx.fillRect(box.x, box.y - 28, 110, 28);
        ctx.fillStyle = '#ffffff';
        ctx.font = "600 11px 'JetBrains Mono', monospace";
        ctx.fillText(this.state.currentStatus.toUpperCase(), box.x + 8, box.y - 10);

        // Draw landmark key points
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        const landmarks = detection.landmarks;
        const allPoints = landmarks.positions;
        allPoints.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Highlight eyes & mouth
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        
        const drawLandmarkPath = (points) => {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.closePath();
            ctx.stroke();
        };

        drawLandmarkPath(landmarks.getLeftEye());
        drawLandmarkPath(landmarks.getRightEye());

        // Display numeric scores on top left
        ctx.fillStyle = 'rgba(9, 9, 11, 0.55)';
        ctx.fillRect(15, 15, 220, 95);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeRect(15, 15, 220, 95);

        ctx.fillStyle = '#ffffff';
        ctx.font = "500 11px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText(`EYE APERTURE (EAR): ${EAR.toFixed(3)}`, 25, 38);
        ctx.fillText(`GAZE DEVIATION   : ${((headPose - 0.5) * 100).toFixed(1)}°`, 25, 58);
        ctx.fillText(`MOUTH OPEN (MAR) : ${MAR.toFixed(3)}`, 25, 78);
        ctx.fillText(`STATUS           : ${this.state.currentStatus.toUpperCase()}`, 25, 98);
    },

    /**
     * Draws neon red border box surrounding target cell phone detection
     */
    drawPhoneBoundingBox(phone) {
        const ctx = this.resources.ctx;
        if (!ctx) return;

        const [x, y, width, height] = phone.bbox;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(239, 68, 68, 0.95)';
        ctx.strokeRect(x, y, width, height);

        // Bounding Box text tag
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.fillRect(x, y - 24, 130, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.fillText("📱 CELL PHONE IN USE", x + 6, y - 8);

        ctx.shadowBlur = 0; // reset
    },

    /**
     * Synchronizes raw values with HTML visual gauge controls
     */
    updateGaugeIndicators() {
        const earGauge = document.getElementById('liveEarGauge');
        const marGauge = document.getElementById('liveMarGauge');
        const gazeGauge = document.getElementById('liveGazeGauge');
        const liveStatusEl = document.getElementById('liveFocusStatus');

        if (earGauge) {
            const percent = Math.min(100, Math.max(0, Math.round((this.state.ear / 0.4) * 100)));
            earGauge.style.width = `${percent}%`;
            earGauge.textContent = this.state.ear.toFixed(3);
        }

        if (marGauge) {
            const percent = Math.min(100, Math.max(0, Math.round((this.state.mar / 0.3) * 100)));
            marGauge.style.width = `${percent}%`;
            marGauge.textContent = this.state.mar.toFixed(3);
        }

        if (gazeGauge) {
            const offset = (this.state.noseOffset - 0.5) * 200; // -100 to 100
            const displayAngle = Math.round(offset);
            gazeGauge.style.width = `${Math.min(100, Math.max(0, 50 + displayAngle / 2))}%`;
            gazeGauge.textContent = `${displayAngle > 0 ? '+' : ''}${displayAngle}°`;
        }

        if (liveStatusEl) {
            liveStatusEl.className = 'status-badge';
            
            let label = 'Focused & Attentive';
            if (this.state.currentStatus === 'drowsy') { liveStatusEl.classList.add('danger'); label = 'Warning: Drowsy Detected'; }
            else if (this.state.currentStatus === 'distracted') { liveStatusEl.classList.add('warning'); label = 'Warning: Turned Away'; }
            else if (this.state.currentStatus === 'phone_usage') { liveStatusEl.classList.add('danger'); label = 'Warning: Smartphone Detected'; }
            else if (this.state.currentStatus === 'absent') { liveStatusEl.classList.add('warning'); label = 'Tutor Absent'; }
            else if (this.state.currentStatus === 'speaking') { liveStatusEl.classList.add('info'); label = 'Speaking detected'; }
            else { liveStatusEl.classList.add('success'); }

            liveStatusEl.textContent = label.toUpperCase();
        }
    },

    /**
     * Updates UI buttons & panel overlays based on active state
     */
    updateUiState() {
        const startBtn = document.getElementById('startFocusBtn');
        const stopBtn = document.getElementById('stopFocusBtn');
        const activeOverlay = document.getElementById('focusActiveOverlay');

        if (this.state.active) {
            if (startBtn) startBtn.classList.add('hidden');
            if (stopBtn) stopBtn.classList.remove('hidden');
            if (activeOverlay) activeOverlay.classList.remove('hidden');
        } else {
            if (startBtn) startBtn.classList.remove('hidden');
            if (stopBtn) stopBtn.classList.add('hidden');
            if (activeOverlay) activeOverlay.classList.add('hidden');
            
            const timerEl = document.getElementById('focusSessionTimer');
            if (timerEl) timerEl.textContent = "00:00";
        }
    }
};
