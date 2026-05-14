import express from "express";

const router = express.Router();


// CHAT ROUTE

router.post("/", async (req, res) => {

  try {

    const {

      message,

      subject,

      notes,

      tasks,

      flashcards

    } = req.body;


    // PROMPT

    const prompt = `

You are BioQuorix AI.

You are an advanced multilingual AI tutor.

You help students deeply understand concepts.

You support:
- English
- Hindi
- Malayalam
- Tamil
- Arabic
- Japanese
- Multilingual conversations

CURRENT SUBJECT:
${subject}

NOTES:
${notes}

TASKS:
${JSON.stringify(tasks)}

FLASHCARDS:
${JSON.stringify(flashcards)}

USER QUESTION:
${message}

RULES:
- Be concise
- Be educational
- Use markdown formatting
- Respond in user's language
- Be friendly and intelligent

`;


    // OLLAMA REQUEST

    const response = await fetch(

      "http://localhost:11434/api/generate",

      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json"

        },

        body: JSON.stringify({

          model: "gemma3:4b",

          prompt,

          stream: false

        })

      }

    );


    const data =
      await response.json();


    res.json({

      success: true,

      response: data.response

    });

  } catch (error) {

    console.error(error);

    res.status(500).json({

      success: false,

      message:
        "Gemma request failed"

    });

  }

});


export default router;