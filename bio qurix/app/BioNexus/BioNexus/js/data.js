/* ============================================
   BioQuorix — Biotechnology Content Data
   Mock data, curriculum structure, and prompt templates
   ============================================ */

const BIOTECH_TOPICS = {
  school: [
    {
      id: 'cell-biology',
      name: 'Cell Biology & Structure',
      icon: '🔬',
      description: 'Prokaryotic & eukaryotic cells, organelles, cell membrane',
      difficulty: 'beginner',
      prereqs: [],
      order: 1
    },
    {
      id: 'dna-structure',
      name: 'DNA Structure & Replication',
      icon: '🧬',
      description: 'Double helix, base pairing, DNA replication process',
      difficulty: 'beginner',
      prereqs: ['cell-biology'],
      order: 2
    },
    {
      id: 'central-dogma',
      name: 'Central Dogma of Molecular Biology',
      icon: '📜',
      description: 'Transcription, translation, genetic code',
      difficulty: 'intermediate',
      prereqs: ['dna-structure'],
      order: 3
    },
    {
      id: 'genetics-inheritance',
      name: 'Genetics & Inheritance',
      icon: '🧪',
      description: 'Mendelian genetics, crosses, pedigree analysis',
      difficulty: 'intermediate',
      prereqs: ['central-dogma'],
      order: 4
    },
    {
      id: 'biotechnology-intro',
      name: 'Introduction to Biotechnology',
      icon: '⚗️',
      description: 'What is biotech, applications, history',
      difficulty: 'beginner',
      prereqs: [],
      order: 5
    },
    {
      id: 'rdna-technology',
      name: 'Recombinant DNA Technology',
      icon: '✂️',
      description: 'Restriction enzymes, cloning vectors, gene cloning',
      difficulty: 'intermediate',
      prereqs: ['dna-structure', 'biotechnology-intro'],
      order: 6
    },
    {
      id: 'pcr',
      name: 'PCR & Gel Electrophoresis',
      icon: '🔥',
      description: 'Polymerase chain reaction, agarose gel, DNA analysis',
      difficulty: 'intermediate',
      prereqs: ['dna-structure'],
      order: 7
    },
    {
      id: 'microorganisms',
      name: 'Microorganisms in Biotechnology',
      icon: '🦠',
      description: 'Bacteria, yeast, fermentation, industrial applications',
      difficulty: 'beginner',
      prereqs: ['cell-biology'],
      order: 8
    },
    {
      id: 'plant-tissue-culture',
      name: 'Plant Tissue Culture',
      icon: '🌱',
      description: 'Micropropagation, somatic embryogenesis, applications',
      difficulty: 'intermediate',
      prereqs: ['cell-biology', 'biotechnology-intro'],
      order: 9
    },
    {
      id: 'bioethics',
      name: 'Bioethics & Biosafety',
      icon: '⚖️',
      description: 'GMO debates, ethical issues, biosafety guidelines',
      difficulty: 'beginner',
      prereqs: ['biotechnology-intro'],
      order: 10
    }
  ],
  university: [
    {
      id: 'molecular-biology',
      name: 'Advanced Molecular Biology',
      icon: '🧬',
      description: 'Gene regulation, epigenetics, chromatin structure',
      difficulty: 'intermediate',
      prereqs: [],
      order: 1
    },
    {
      id: 'genomics',
      name: 'Genomics & Proteomics',
      icon: '🖥️',
      description: 'Genome sequencing, NGS, proteome analysis, bioinformatics',
      difficulty: 'advanced',
      prereqs: ['molecular-biology'],
      order: 2
    },
    {
      id: 'genetic-engineering',
      name: 'Genetic Engineering',
      icon: '✂️',
      description: 'CRISPR-Cas9, gene editing, transgenic organisms',
      difficulty: 'advanced',
      prereqs: ['molecular-biology'],
      order: 3
    },
    {
      id: 'enzyme-technology',
      name: 'Enzyme Technology',
      icon: '⚙️',
      description: 'Enzyme kinetics, immobilization, industrial enzymes',
      difficulty: 'intermediate',
      prereqs: [],
      order: 4
    },
    {
      id: 'fermentation-tech',
      name: 'Fermentation Technology',
      icon: '🏭',
      description: 'Bioreactor design, upstream/downstream processing',
      difficulty: 'intermediate',
      prereqs: ['enzyme-technology'],
      order: 5
    },
    {
      id: 'immunology',
      name: 'Immunology & Immunotechnology',
      icon: '🛡️',
      description: 'Immune system, antibodies, ELISA, monoclonal antibodies',
      difficulty: 'advanced',
      prereqs: ['molecular-biology'],
      order: 6
    },
    {
      id: 'bioinformatics',
      name: 'Bioinformatics',
      icon: '💻',
      description: 'Sequence alignment, BLAST, phylogenetics, databases',
      difficulty: 'advanced',
      prereqs: ['genomics'],
      order: 7
    },
    {
      id: 'environmental-biotech',
      name: 'Environmental Biotechnology',
      icon: '🌍',
      description: 'Bioremediation, waste treatment, biofuels',
      difficulty: 'intermediate',
      prereqs: [],
      order: 8
    },
    {
      id: 'pharmaceutical-biotech',
      name: 'Pharmaceutical Biotechnology',
      icon: '💊',
      description: 'Drug discovery, biosimilars, vaccine development',
      difficulty: 'advanced',
      prereqs: ['immunology', 'genetic-engineering'],
      order: 9
    },
    {
      id: 'stem-cells',
      name: 'Stem Cells & Regenerative Medicine',
      icon: '🧫',
      description: 'iPSCs, tissue engineering, therapeutic applications',
      difficulty: 'advanced',
      prereqs: ['molecular-biology'],
      order: 10
    }
  ]
};

// Fallback quiz bank (used when Gemini API is not available)
const QUIZ_BANK = {
  'cell-biology': [
    {
      question: "Which organelle is known as the 'powerhouse of the cell'?",
      options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi Apparatus'],
      correct: 1,
      explanation: 'Mitochondria generate most of the cell\'s ATP through oxidative phosphorylation, earning them the nickname "powerhouse of the cell".'
    },
    {
      question: 'What is the primary function of ribosomes?',
      options: ['DNA replication', 'Protein synthesis', 'Lipid metabolism', 'Cell signaling'],
      correct: 1,
      explanation: 'Ribosomes translate mRNA into amino acid sequences, making proteins essential for cell function.'
    },
    {
      question: 'Which structure is present in plant cells but NOT in animal cells?',
      options: ['Mitochondria', 'Cell membrane', 'Cell wall', 'Nucleus'],
      correct: 2,
      explanation: 'Plant cells have a rigid cell wall made of cellulose outside the cell membrane. Animal cells only have a cell membrane.'
    },
    {
      question: 'The fluid-filled space inside a cell membrane is called:',
      options: ['Nucleoplasm', 'Cytoplasm', 'Protoplasm', 'Ectoplasm'],
      correct: 1,
      explanation: 'Cytoplasm is the gel-like substance within the cell membrane that contains organelles and is the site of many metabolic reactions.'
    },
    {
      question: 'Which type of cell lacks a membrane-bound nucleus?',
      options: ['Eukaryotic', 'Prokaryotic', 'Plant cell', 'Fungal cell'],
      correct: 1,
      explanation: 'Prokaryotic cells (bacteria & archaea) lack a membrane-bound nucleus. Their DNA floats freely in the cytoplasm in a region called the nucleoid.'
    }
  ],
  'dna-structure': [
    {
      question: 'DNA stands for:',
      options: ['Deoxyribonucleic Acid', 'Dinitrogen Acid', 'Deoxyribosomal Acid', 'Dinucleotide Acid'],
      correct: 0,
      explanation: 'DNA stands for Deoxyribonucleic Acid — the molecule that carries genetic instructions for life.'
    },
    {
      question: 'Which base pairs with Adenine (A) in DNA?',
      options: ['Cytosine', 'Guanine', 'Thymine', 'Uracil'],
      correct: 2,
      explanation: 'In DNA, Adenine (A) always pairs with Thymine (T) via 2 hydrogen bonds. Guanine pairs with Cytosine via 3 hydrogen bonds.'
    },
    {
      question: 'The enzyme that unwinds the DNA double helix during replication is:',
      options: ['DNA Polymerase', 'Helicase', 'Ligase', 'Primase'],
      correct: 1,
      explanation: 'Helicase unwinds and separates the two strands of DNA by breaking hydrogen bonds between base pairs.'
    },
    {
      question: 'DNA replication is described as:',
      options: ['Conservative', 'Semi-conservative', 'Dispersive', 'Non-conservative'],
      correct: 1,
      explanation: 'DNA replication is semi-conservative — each new DNA molecule consists of one original (parent) strand and one new (daughter) strand.'
    },
    {
      question: 'The sugar found in DNA is:',
      options: ['Ribose', 'Deoxyribose', 'Glucose', 'Fructose'],
      correct: 1,
      explanation: 'DNA contains deoxyribose sugar (missing one oxygen atom compared to ribose found in RNA).'
    }
  ],
  'central-dogma': [
    {
      question: 'The Central Dogma of molecular biology describes:',
      options: ['Cell division', 'Flow of genetic information: DNA → RNA → Protein', 'Protein folding', 'Cell signaling'],
      correct: 1,
      explanation: 'The Central Dogma states that genetic information flows from DNA to RNA (transcription) and from RNA to Protein (translation).'
    },
    {
      question: 'The process of making mRNA from DNA is called:',
      options: ['Translation', 'Replication', 'Transcription', 'Transduction'],
      correct: 2,
      explanation: 'Transcription is the process where RNA polymerase reads a DNA template and synthesizes a complementary mRNA strand.'
    },
    {
      question: 'How many nucleotides code for one amino acid (a codon)?',
      options: ['1', '2', '3', '4'],
      correct: 2,
      explanation: 'A codon is a sequence of 3 nucleotides that codes for a specific amino acid. There are 64 possible codons coding for 20 amino acids.'
    },
    {
      question: 'Which RNA carries amino acids to the ribosome during translation?',
      options: ['mRNA', 'tRNA', 'rRNA', 'snRNA'],
      correct: 1,
      explanation: 'tRNA (transfer RNA) carries specific amino acids to the ribosome, matching its anticodon to the mRNA codon.'
    },
    {
      question: 'The start codon AUG codes for which amino acid?',
      options: ['Valine', 'Leucine', 'Methionine', 'Alanine'],
      correct: 2,
      explanation: 'AUG is the universal start codon and codes for Methionine (Met), which initiates protein synthesis.'
    }
  ],
  'pcr': [
    {
      question: 'PCR stands for:',
      options: ['Protein Chain Reaction', 'Polymerase Chain Reaction', 'Polymer Catalytic Reaction', 'Primary Cell Replication'],
      correct: 1,
      explanation: 'PCR (Polymerase Chain Reaction) is a technique to amplify specific DNA segments millions of times.'
    },
    {
      question: 'Which enzyme is used in PCR?',
      options: ['DNA Ligase', 'Restriction enzyme', 'Taq DNA Polymerase', 'RNA Polymerase'],
      correct: 2,
      explanation: 'Taq DNA Polymerase, isolated from Thermus aquaticus, is heat-stable and works at high temperatures (72°C), making it ideal for PCR.'
    },
    {
      question: 'The three steps of each PCR cycle are:',
      options: ['Ligation, Amplification, Detection', 'Denaturation, Annealing, Extension', 'Extraction, Purification, Analysis', 'Cutting, Joining, Screening'],
      correct: 1,
      explanation: 'Each PCR cycle has: Denaturation (95°C) — strands separate; Annealing (50-65°C) — primers bind; Extension (72°C) — Taq extends new strand.'
    },
    {
      question: 'After 30 cycles of PCR, approximately how many copies are produced?',
      options: ['30 copies', 'Thousands', 'Millions', 'Over a billion'],
      correct: 3,
      explanation: 'PCR doubles DNA each cycle. After 30 cycles: 2^30 = ~1 billion copies from a single template!'
    },
    {
      question: 'In gel electrophoresis, DNA migrates towards the:',
      options: ['Negative electrode', 'Positive electrode', 'Neither', 'Both'],
      correct: 1,
      explanation: 'DNA is negatively charged (due to phosphate groups), so it migrates towards the positive electrode (anode) during electrophoresis.'
    }
  ],
  'rdna-technology': [
    {
      question: 'Restriction enzymes are also called:',
      options: ['Polymerases', 'Molecular scissors', 'Ligases', 'Helicases'],
      correct: 1,
      explanation: 'Restriction enzymes cut DNA at specific recognition sequences, hence they are called "molecular scissors" of genetic engineering.'
    },
    {
      question: 'What is a cloning vector?',
      options: ['A disease-carrying organism', 'A DNA molecule used to carry foreign DNA into a host cell', 'A type of enzyme', 'A PCR primer'],
      correct: 1,
      explanation: 'A cloning vector (e.g., plasmid, phage) is a small DNA molecule capable of replicating inside a host cell, used to carry and replicate foreign DNA.'
    },
    {
      question: 'EcoRI recognizes and cuts the sequence:',
      options: ['AAGCTT', 'GAATTC', 'GGATCC', 'CTCGAG'],
      correct: 1,
      explanation: 'EcoRI (from E. coli) recognizes the palindromic sequence GAATTC and cuts between G and A on both strands, creating sticky ends.'
    },
    {
      question: 'Which enzyme joins DNA fragments together?',
      options: ['DNA Polymerase', 'Helicase', 'DNA Ligase', 'Topoisomerase'],
      correct: 2,
      explanation: 'DNA Ligase seals the sugar-phosphate backbone by forming phosphodiester bonds between DNA fragments, joining them together.'
    },
    {
      question: '"Sticky ends" refers to:',
      options: ['Blunt DNA cuts', 'Single-stranded overhangs that can base-pair', 'Damaged DNA', 'Protein-coated DNA'],
      correct: 1,
      explanation: 'Sticky ends are short single-stranded overhangs created by certain restriction enzymes. They base-pair with complementary sticky ends, facilitating ligation.'
    }
  ],
  'molecular-biology': [
    {
      question: 'Epigenetics refers to:',
      options: ['Mutations in DNA sequence', 'Heritable changes in gene expression without altering DNA sequence', 'Protein folding', 'Chromosome counting'],
      correct: 1,
      explanation: 'Epigenetics involves modifications like DNA methylation and histone modification that affect gene expression without changing the underlying DNA sequence.'
    },
    {
      question: 'Which histone modification is associated with gene activation?',
      options: ['Deacetylation', 'Methylation of H3K9', 'Acetylation of H3K27', 'Ubiquitination'],
      correct: 2,
      explanation: 'Histone acetylation (e.g., H3K27ac) loosens chromatin structure, making DNA more accessible to transcription factors, thus activating gene expression.'
    },
    {
      question: 'The lac operon is regulated by:',
      options: ['Temperature only', 'Lactose and glucose levels', 'pH changes', 'Light exposure'],
      correct: 1,
      explanation: 'The lac operon is induced by allolactose (from lactose) and repressed when glucose is available (catabolite repression via cAMP-CAP complex).'
    },
    {
      question: 'What is the role of enhancers in gene regulation?',
      options: ['They degrade mRNA', 'They increase transcription of target genes from a distance', 'They block translation', 'They replicate DNA'],
      correct: 1,
      explanation: 'Enhancers are cis-regulatory DNA elements that can increase transcription of target genes. They work over long distances via DNA looping.'
    },
    {
      question: 'RNA interference (RNAi) involves:',
      options: ['RNA amplification', 'Gene silencing through small RNA molecules', 'Protein degradation', 'DNA methylation'],
      correct: 1,
      explanation: 'RNAi is a gene-silencing mechanism where small RNA molecules (siRNA, miRNA) guide the RISC complex to degrade complementary mRNA or inhibit translation.'
    }
  ],
  'genetic-engineering': [
    {
      question: 'CRISPR-Cas9 is:',
      options: ['A vaccine technology', 'A gene-editing tool using guide RNA and Cas9 nuclease', 'A cloning vector', 'A sequencing method'],
      correct: 1,
      explanation: 'CRISPR-Cas9 uses a guide RNA to direct the Cas9 enzyme to a specific DNA location, where it creates a double-strand break for precise gene editing.'
    },
    {
      question: 'What is a "knock-out" organism?',
      options: ['An organism with extra genes', 'An organism where a specific gene has been inactivated', 'A cloned organism', 'A hybrid organism'],
      correct: 1,
      explanation: 'A knock-out organism has a specific gene deliberately inactivated or deleted to study that gene\'s function in vivo.'
    },
    {
      question: 'The first commercially grown GM crop was:',
      options: ['Bt Cotton', 'Flavr Savr Tomato', 'Golden Rice', 'Roundup Ready Soybean'],
      correct: 1,
      explanation: 'The Flavr Savr tomato (1994) was the first commercially grown genetically modified food. It had delayed ripening for longer shelf life.'
    },
    {
      question: 'Golden Rice is engineered to produce:',
      options: ['Extra protein', 'Beta-carotene (provitamin A)', 'Vitamin C', 'Iron'],
      correct: 1,
      explanation: 'Golden Rice contains genes for beta-carotene biosynthesis, addressing Vitamin A deficiency in developing countries.'
    },
    {
      question: 'PAM sequence in CRISPR stands for:',
      options: ['Protein Attached Molecule', 'Protospacer Adjacent Motif', 'Polymerase Active Module', 'Primer Annealing Mark'],
      correct: 1,
      explanation: 'PAM (Protospacer Adjacent Motif) is a short DNA sequence (typically NGG for SpCas9) required adjacent to the target site for Cas9 binding and cleavage.'
    }
  ],
  'enzyme-technology': [
    {
      question: 'The Michaelis-Menten constant (Km) represents:',
      options: ['Maximum reaction velocity', 'Substrate concentration at half Vmax', 'Enzyme concentration', 'Product formation rate'],
      correct: 1,
      explanation: 'Km is the substrate concentration at which the reaction velocity is half of Vmax. A lower Km indicates higher enzyme-substrate affinity.'
    },
    {
      question: 'Enzyme immobilization means:',
      options: ['Destroying enzymes', 'Fixing enzymes to a support for reuse', 'Purifying enzymes', 'Mutating enzymes'],
      correct: 1,
      explanation: 'Enzyme immobilization attaches enzymes to insoluble supports (beads, membranes), allowing reuse, improving stability, and enabling continuous processes.'
    },
    {
      question: 'Which is an example of an industrial enzyme application?',
      options: ['Using lipase in detergents', 'DNA sequencing', 'Gel electrophoresis', 'PCR amplification'],
      correct: 0,
      explanation: 'Lipases are widely used in laundry detergents to break down fat/grease stains. Other examples include amylase in baking and protease in meat tenderization.'
    },
    {
      question: 'Allosteric enzyme regulation involves:',
      options: ['Binding at the active site', 'Binding at a site other than the active site', 'Enzyme degradation', 'Gene silencing'],
      correct: 1,
      explanation: 'Allosteric regulation involves effector molecules binding to a regulatory site (not the active site), causing conformational changes that alter enzyme activity.'
    },
    {
      question: 'Enzyme specificity is due to:',
      options: ['Random interactions', 'Lock and key / induced fit model', 'High temperature', 'Low pH'],
      correct: 1,
      explanation: 'The lock-and-key and induced-fit models explain enzyme specificity — the active site shape complements the substrate, ensuring only specific substrates bind.'
    }
  ],
  'biotechnology-intro': [
    {
      question: 'Biotechnology primarily involves:',
      options: ['Only computer science', 'Using living organisms or their products for human benefit', 'Only chemistry', 'Only physics'],
      correct: 1,
      explanation: 'Biotechnology uses biological systems, living organisms, or their derivatives to develop products and processes for human benefit.'
    },
    {
      question: 'Which is NOT a branch of biotechnology?',
      options: ['Red Biotechnology (Medical)', 'Green Biotechnology (Agricultural)', 'Blue Biotechnology (Marine)', 'Black Biotechnology (Space)'],
      correct: 3,
      explanation: 'The main color-coded branches are: Red (medical), Green (agricultural), White (industrial), Blue (marine), and Grey (environmental). There is no "Black" biotechnology.'
    },
    {
      question: 'The process of making curd from milk is an example of:',
      options: ['Genetic engineering', 'Traditional biotechnology', 'Nanotechnology', 'Bioinformatics'],
      correct: 1,
      explanation: 'Making curd involves Lactobacillus bacteria fermenting lactose in milk — a classic example of traditional biotechnology used for millennia.'
    },
    {
      question: 'Who is considered the father of biotechnology?',
      options: ['Gregor Mendel', 'Louis Pasteur', 'Karl Ereky', 'James Watson'],
      correct: 2,
      explanation: 'Karl Ereky, a Hungarian agricultural engineer, coined the term "biotechnology" in 1919 and is considered its father.'
    },
    {
      question: 'Insulin produced by genetically modified bacteria is called:',
      options: ['Natural insulin', 'Humulin', 'Bovine insulin', 'Synthetic chemical insulin'],
      correct: 1,
      explanation: 'Humulin was the first recombinant DNA pharmaceutical product — human insulin produced by E. coli bacteria, approved by FDA in 1982.'
    }
  ],
  'genetics-inheritance': [
    {
      question: "Mendel's Law of Segregation states that:",
      options: ['Genes are always dominant', 'Two alleles of a gene separate during gamete formation', 'All traits are linked', 'Mutations always occur'],
      correct: 1,
      explanation: 'The Law of Segregation states that during gamete formation, the two alleles for each gene separate so each gamete carries only one allele.'
    },
    {
      question: 'A cross between Tt x Tt produces which genotypic ratio?',
      options: ['1:1', '3:1', '1:2:1', '1:1:1:1'],
      correct: 2,
      explanation: 'A monohybrid cross Tt × Tt produces: 1 TT : 2 Tt : 1 tt (genotypic ratio 1:2:1). The phenotypic ratio is 3:1 (dominant:recessive).'
    },
    {
      question: 'Blood group inheritance is an example of:',
      options: ['Complete dominance', 'Codominance and multiple alleles', 'Epistasis', 'Polygenic inheritance'],
      correct: 1,
      explanation: 'ABO blood groups show codominance (A and B alleles are codominant) and involve multiple alleles (I^A, I^B, and i).'
    },
    {
      question: 'What is a carrier in genetics?',
      options: ['Someone with a dominant phenotype', 'A heterozygous individual carrying a recessive allele without showing the trait', 'A mutant organism', 'A gamete'],
      correct: 1,
      explanation: 'A carrier is heterozygous (e.g., Aa) — they carry one copy of a recessive allele without expressing the recessive phenotype.'
    },
    {
      question: 'Sex-linked traits are carried on:',
      options: ['Autosomes only', 'Sex chromosomes (usually X)', 'Mitochondrial DNA', 'Plasmids'],
      correct: 1,
      explanation: 'Sex-linked traits (like color blindness, hemophilia) are typically carried on the X chromosome. Males (XY) are more affected as they have only one X.'
    }
  ],
  'microorganisms': [
    {
      question: 'Which microorganism is used in bread making?',
      options: ['E. coli', 'Saccharomyces cerevisiae (Baker\'s yeast)', 'Staphylococcus', 'Plasmodium'],
      correct: 1,
      explanation: 'Saccharomyces cerevisiae (baker\'s yeast) ferments sugars producing CO₂, which causes bread dough to rise.'
    },
    {
      question: 'Penicillin was discovered from:',
      options: ['A bacterium', 'A virus', 'A fungus (Penicillium notatum)', 'A plant'],
      correct: 2,
      explanation: 'Alexander Fleming discovered penicillin in 1928 from the mold Penicillium notatum, revolutionizing medicine with the first antibiotic.'
    },
    {
      question: 'Fermentation is:',
      options: ['Aerobic respiration', 'Anaerobic breakdown of sugars by microorganisms', 'Photosynthesis', 'DNA replication'],
      correct: 1,
      explanation: 'Fermentation is the anaerobic metabolic process where microorganisms break down sugars to produce alcohol, acids, or gases.'
    },
    {
      question: 'Which bacteria is used in the production of curd?',
      options: ['E. coli', 'Lactobacillus', 'Bacillus subtilis', 'Streptococcus'],
      correct: 1,
      explanation: 'Lactobacillus converts lactose (milk sugar) into lactic acid, which coagulates milk proteins to form curd (yogurt).'
    },
    {
      question: 'Bioremediation uses microorganisms to:',
      options: ['Create new chemicals', 'Clean up pollutants from the environment', 'Produce vaccines', 'Sequence DNA'],
      correct: 1,
      explanation: 'Bioremediation uses naturally occurring or engineered microorganisms to degrade or detoxify environmental pollutants like oil spills and heavy metals.'
    }
  ],
  'genomics': [
    {
      question: 'Next-Generation Sequencing (NGS) enables:',
      options: ['Manual DNA reading', 'Massively parallel sequencing of millions of DNA fragments', 'Protein crystallography', 'Cell counting'],
      correct: 1,
      explanation: 'NGS technologies (Illumina, PacBio, Oxford Nanopore) can sequence millions of DNA fragments simultaneously, making whole-genome sequencing fast and affordable.'
    },
    {
      question: 'The Human Genome Project was completed in:',
      options: ['1990', '2000', '2003', '2010'],
      correct: 2,
      explanation: 'The Human Genome Project was completed in 2003, mapping the ~3 billion base pairs of the human genome and identifying ~20,000-25,000 genes.'
    },
    {
      question: 'A proteome is:',
      options: ['The entire DNA of an organism', 'The complete set of proteins expressed by a genome', 'A type of RNA', 'A protein database'],
      correct: 1,
      explanation: 'The proteome is the entire set of proteins expressed by a genome, cell, tissue, or organism at a specific time. It is dynamic and changes with conditions.'
    },
    {
      question: 'SNP stands for:',
      options: ['Single Nucleotide Polymorphism', 'Specific Nuclear Protein', 'Sequence Navigation Protocol', 'Standard Naming Practice'],
      correct: 0,
      explanation: 'SNPs are variations at single nucleotide positions in the genome. They are the most common type of genetic variation and useful for genetic mapping and disease association studies.'
    },
    {
      question: 'Metagenomics studies:',
      options: ['Single organism genomes', 'Genetic material from environmental samples containing many organisms', 'Protein structure', 'Cell morphology'],
      correct: 1,
      explanation: 'Metagenomics analyzes genetic material recovered directly from environmental samples (soil, water, gut), studying entire microbial communities without culturing.'
    }
  ],
  'immunology': [
    {
      question: 'Monoclonal antibodies are produced by:',
      options: ['Mixing many B cells', 'Fusing a B cell with a myeloma cell to create a hybridoma', 'Chemical synthesis', 'PCR amplification'],
      correct: 1,
      explanation: 'Monoclonal antibodies are produced by hybridoma technology — fusing an antibody-producing B cell with a myeloma (cancer) cell to create an immortal antibody-producing cell line.'
    },
    {
      question: 'ELISA is used for:',
      options: ['DNA sequencing', 'Detecting and quantifying proteins/antibodies using enzyme-linked reactions', 'Cell culture', 'Gene editing'],
      correct: 1,
      explanation: 'ELISA (Enzyme-Linked Immunosorbent Assay) uses enzyme-linked antibodies to detect and quantify specific proteins, hormones, or antibodies in samples.'
    },
    {
      question: 'The mRNA COVID-19 vaccines work by:',
      options: ['Injecting the virus', 'Delivering mRNA that instructs cells to produce the spike protein, triggering an immune response', 'Gene therapy', 'Antibiotic treatment'],
      correct: 1,
      explanation: 'mRNA vaccines deliver synthetic mRNA encoding the SARS-CoV-2 spike protein. Cells produce the spike protein, the immune system recognizes it as foreign, and mounts a protective response.'
    },
    {
      question: 'Which cells are the main targets of HIV?',
      options: ['Red blood cells', 'CD4+ T helper cells', 'Platelets', 'Neurons'],
      correct: 1,
      explanation: 'HIV specifically targets CD4+ T helper cells, which coordinate the immune response. Their depletion leads to immunodeficiency (AIDS).'
    },
    {
      question: 'Passive immunity is:',
      options: ['Immunity developed after vaccination', 'Transfer of pre-formed antibodies from one individual to another', 'Immunity from infection', 'Cell-mediated immunity'],
      correct: 1,
      explanation: 'Passive immunity involves receiving pre-formed antibodies (e.g., maternal antibodies via breast milk, or therapeutic antibody injections). It provides immediate but temporary protection.'
    }
  ],
  'plant-tissue-culture': [
    {
      question: 'Totipotency means:',
      options: ['Cells can only divide', 'A single cell can develop into a complete organism', 'Cells are dead', 'Cells cannot differentiate'],
      correct: 1,
      explanation: 'Totipotency is the ability of a single plant cell to develop into a whole organism when given appropriate conditions — the basis of plant tissue culture.'
    },
    {
      question: 'MS medium is commonly used in plant tissue culture. MS stands for:',
      options: ['Micro Solution', 'Murashige and Skoog', 'Mineral Salt', 'Modified Substrate'],
      correct: 1,
      explanation: 'MS (Murashige and Skoog) medium, developed in 1962, is the most widely used nutrient medium for plant tissue culture, containing macro/micronutrients and vitamins.'
    },
    {
      question: 'A callus is:',
      options: ['A mature plant', 'An unorganized mass of dividing cells', 'A seed', 'A flower structure'],
      correct: 1,
      explanation: 'A callus is an undifferentiated mass of cells formed when plant tissue is cultured on a medium with appropriate plant growth regulators (auxins and cytokinins).'
    },
    {
      question: 'Somatic embryogenesis produces:',
      options: ['Seeds', 'Embryos from somatic (non-reproductive) cells', 'Pollen grains', 'Root tips'],
      correct: 1,
      explanation: 'Somatic embryogenesis is the formation of embryos from non-reproductive (somatic) cells in culture, bypassing the need for fertilization.'
    },
    {
      question: 'Micropropagation is used for:',
      options: ['Genetic modification', 'Rapid mass multiplication of plants', 'Protein production', 'Drug synthesis'],
      correct: 1,
      explanation: 'Micropropagation uses tissue culture to rapidly produce thousands of genetically identical plants (clones) from a small piece of plant tissue.'
    }
  ],
  'bioethics': [
    {
      question: 'GMO stands for:',
      options: ['Generally Modified Organism', 'Genetically Modified Organism', 'Genetically Multiplied Organism', 'Genome Mapping Object'],
      correct: 1,
      explanation: 'GMO (Genetically Modified Organism) is an organism whose genetic material has been altered using genetic engineering techniques.'
    },
    {
      question: 'The Cartagena Protocol is related to:',
      options: ['Human rights', 'Biosafety of living modified organisms', 'Climate change', 'Nuclear safety'],
      correct: 1,
      explanation: 'The Cartagena Protocol on Biosafety (2000) governs the handling, transport, and use of Living Modified Organisms (LMOs) resulting from biotechnology.'
    },
    {
      question: 'Bioethics in human cloning concerns:',
      options: ['Only economic issues', 'Moral, ethical, and social implications of cloning humans', 'Only legal issues', 'Only technical feasibility'],
      correct: 1,
      explanation: 'Human cloning raises deep ethical questions about identity, dignity, consent, and the moral status of cloned individuals, leading to widespread bans on reproductive cloning.'
    },
    {
      question: 'Informed consent in biotech research means:',
      options: ['Participants must be paid', 'Participants are fully informed about risks and voluntarily agree', 'No consent is needed', 'Only written forms matter'],
      correct: 1,
      explanation: 'Informed consent requires that research participants understand the purpose, methods, risks, and benefits of a study before voluntarily agreeing to participate.'
    },
    {
      question: 'The acronym GEAC in India stands for:',
      options: ['Gene Engineering Advisory Council', 'Genetic Engineering Appraisal Committee', 'General Environmental Assessment Committee', 'Genome Editing Authorization Center'],
      correct: 1,
      explanation: 'GEAC (Genetic Engineering Appraisal Committee) is the apex body under India\'s Ministry of Environment that approves the release of GMOs for commercial use.'
    }
  ]
};

// Prompt templates for Gemini API
const PROMPT_TEMPLATES = {
  generateLesson: (topic, level, profile) => `You are BioQuorix, an expert biotechnology tutor.

Generate a comprehensive, engaging lesson on "${topic.name}" for a ${level === 'school' ? 'high school (Class 11-12)' : 'university (B.Sc/B.Tech)'} biotechnology student.

${profile.weakAreas?.length ? `The student struggles with: ${profile.weakAreas.join(', ')}. Pay extra attention to these concepts.` : ''}
${profile.completedTopics?.length ? `They have already studied: ${profile.completedTopics.join(', ')}. Build upon this knowledge.` : ''}

Structure the lesson as:
1. **Introduction** — What is this topic and why it matters (with a real-world hook)
2. **Key Concepts** — Core ideas explained clearly with analogies
3. **How It Works** — Step-by-step mechanism/process
4. **Real-World Applications** — Practical examples
5. **Key Takeaways** — Bullet-point summary
6. **Did You Know?** — A fascinating fact

Rules:
- Use simple language with scientific accuracy
- Include analogies to everyday life
- Use markdown formatting (headers, bold, bullet points)
- Keep it under 800 words
- Make it engaging and easy to remember`,

  generateQuiz: (topic, level, difficulty) => `You are BioQuorix quiz generator.

Generate 5 multiple-choice questions on "${topic}" for ${level === 'school' ? 'high school' : 'university'} biotechnology students.
Difficulty: ${difficulty}

Return ONLY a valid JSON array with this exact format (no markdown, no code blocks):
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Brief explanation of the correct answer."
  }
]

Rules:
- Make questions test understanding, not just memory
- Include plausible distractors
- correct is the index (0-3) of the right option
- Keep explanations concise (1-2 sentences)`,

  evaluateAnswer: (question, studentAnswer, correctConcept) => `Evaluate this student's answer:
Question: "${question}"
Student's answer: "${studentAnswer}"
Expected concept: "${correctConcept}"

Score out of 10 and give brief, encouraging feedback.
Format: Score: X/10 | Feedback: ...`,

  recommendPath: (profile) => `Based on this biotechnology student's profile:
- Level: ${profile.level}
- Completed topics: ${profile.completedTopics?.join(', ') || 'None yet'}
- Quiz scores: ${JSON.stringify(profile.quizScores || {})}
- Weak areas: ${profile.weakAreas?.join(', ') || 'Not identified yet'}

Suggest the next 3 topics to study from this list: ${JSON.stringify(BIOTECH_TOPICS[profile.level]?.map(t => t.name) || [])}

Return ONLY a JSON array:
[{"topic": "Topic Name", "reason": "Brief reason"}, ...]`,

  chatResponse: (question, level, context, history = [], personality = 'emoji') => {
    let personalityInstruction = "";
    if (personality === 'professor') {
      personalityInstruction = `PERSONA: You are a distinguished University Professor. 
- Tone: Academic, formal, thorough, and highly authoritative. 
- Use complex terminology correctly. 
- No emojis except maybe a single 📖 or 🔬.
- Structure your answer like a mini-lecture.`;
    } else if (personality === 'comrade') {
      personalityInstruction = `PERSONA: You are an enthusiastic, egalitarian biotech revolutionary.
- Tone: Passionate, collective, and inspiring. 
- Use words like "Comrade", "Our collective knowledge", "For the people".
- Emojis: ✊🛠️🌿🚩.
- Focus on how biotech serves the collective good and accessibility.`;
    } else {
      personalityInstruction = `PERSONA: You are a fun, approachable, and energy-filled biotech guide.
- Tone: Friendly, visually engaging, and highly encouraging. 
- Use plenty of relevant emojis throughout 🧬🧪🌿✨.
- Use analogies and excitement!`;
    }

    return `You are BioQuorix AI Tutor. 
${personalityInstruction}

Student level: ${level === 'school' ? 'High school (Class 11-12)' : 'University (B.Sc/B.Tech)'}
${context ? `Current topic being studied: ${context}` : ''}

${history && history.length > 0 ? `Recent conversation history:
${history.map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.content}`).join('\n')}` : ''}

Student's newest question: "${question}"

Rules:
- Vary your opening based on your persona.
- Keep response under 180 words.
- Use markdown for formatting.
- Redirect off-topic questions politely while staying in character.`;
  },

  generateCurriculum: (topic, level) => `You are an expert biotechnology curriculum designer.
Generate a structured learning path/course for the topic: "${topic}".
Target audience: ${level === 'school' ? 'High school (Class 11-12)' : 'University (B.Sc/B.Tech)'} level student.
  
Identify 3-5 sub-topics that make up a complete module on this subject.
Return ONLY a valid JSON array matching this format (no markdown code blocks around the JSON):
[
  {
    "id": "unique-kebab-case-id",
    "name": "Sub-topic Name",
    "icon": "🧪",
    "description": "Short description of what this covers",
    "difficulty": "intermediate",
    "prereqs": [],
    "order": 1
  }
]`,

  generateFlashcardsDecks: (topicContent) => `You are a study assistant generating spaced-repetition flashcards.
Based on the following lesson content, generate 12 key flashcards for active recall.

Lesson Content:
${topicContent.substring(0, 1500)}...

Return ONLY a valid JSON array matching this format (no markdown code blocks):
[
  {
    "front": "What is the primary function of...?",
    "back": "The primary function is to..."
  }
]`
};
