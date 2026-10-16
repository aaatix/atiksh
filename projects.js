/*
  PROJECTS — used by both the home page cards and the project detail pages.

  Each project:
    slug:      short id used in the page link (project.html?p=slug). No spaces.
    title:     project name
    cats:      small caps line, e.g. "Aerodynamics · CFD"
    where:     place and dates
    desc:      one line shown on the card
    overview:  a paragraph for the pop-up and the top of the project page
    did:       list of things you did (bullets on the project page)
    tags:      tools and skills
    img:       cover image in the images/ folder, e.g. "images/pikes-peak.jpg"
    gallery:   optional extra images [{ src: "images/x.jpg", caption: "..." }]
    link:      optional outside link, e.g. "https://wespot.in"

  To add a project, copy one block, change it, and keep the commas.
*/
window.PROJECTS = [
  {
    slug: "pikes-peak",
    title: "Pikes Peak Race Car Aero",
    cats: "Aerodynamics · CFD",
    where: "Purdue VIP · 2026 – Present",
    desc: "CFD on a Pikes Peak hill-climb car.",
    overview: "Part of Purdue's Vertically Integrated Projects program. I'm building on the team's existing Pikes Peak vehicle models to improve aerodynamic performance over the current baseline.",
    did: [
      "Running CFD simulations in Siemens Simcenter STAR-CCM+",
      "Modelling vehicle geometry in SolidWorks",
      "Working toward a CFD-tested design that beats the current baseline",
    ],
    tags: ["STAR-CCM+", "SolidWorks", "CFD"],
    img: "images/pikes-peak.jpg", gallery: [], link: "",
  },
  {
    slug: "purdue-space-program",
    title: "Purdue Space Program",
    cats: "Rocketry · Design",
    where: "Purdue · 2026 – Present",
    desc: "Designing and simulating rockets.",
    overview: "Member of the Purdue Space Program, learning rocket design and flight simulation.",
    did: [
      "Learning rocket design and flight simulation in OpenRocket",
      "Developing CAD skills in Siemens NX",
    ],
    tags: ["OpenRocket", "Siemens NX"],
    img: "images/psp.jpg", gallery: [], link: "",
  },
  {
    slug: "wespot",
    title: "Wespot",
    cats: "Founder · Automotive",
    where: "Gurgaon, India · 2025 – Present",
    desc: "India's first student-run automotive journalism platform.",
    overview: "I founded Wespot, India's first student-run automotive journalism platform, and grew it to more than 50,000 unique readers.",
    did: [
      "Grew readership to 50,000+ unique readers",
      "Published 10+ articles",
      "Covered Auto Expo 2025 and Motorfest Gurugram",
    ],
    tags: ["Leadership", "Journalism", "Automotive"],
    img: "images/wespot.jpg", gallery: [], link: "https://wespot.in",
  },
  {
    slug: "greenfusion",
    title: "GreenFusion",
    cats: "Founder · Sustainability",
    where: "Gurgaon, India · 2024 – Present",
    desc: "STEM kits built from recycled e-waste.",
    overview: "An e-waste-to-STEM initiative. I designed experiment kits from recycled e-waste for rural students.",
    did: [
      "Designed STEM experiment kits from recycled e-waste",
      "Brought the kits to rural students",
      "Recognized by the IB Youth Action Fund, and selected as a national IB Youth Ambassador for the work",
    ],
    tags: ["Hardware", "Sustainability", "Outreach"],
    img: "images/greenfusion.jpg", gallery: [], link: "",
  },
  {
    slug: "kit-stirling-engine",
    title: "Stirling Engine at KIT",
    cats: "Thermodynamics · Build",
    where: "Karlsruhe, Germany · 2025",
    desc: "Built a working Stirling engine at KIT.",
    overview: "Selected for the International Summer School in Engineering at the Karlsruhe Institute of Technology, one of Germany's leading technical universities.",
    did: [
      "Built a working Stirling engine",
      "Tested bridge designs and characterized solar cells",
      "Lab work on electromagnetism, generators and electric motors, plus CAD modelling",
    ],
    tags: ["Thermodynamics", "Prototyping", "CAD"],
    img: "images/stirling.jpg", gallery: [], link: "",
  },
  {
    slug: "f1-in-schools",
    title: "F1 in Schools",
    cats: "Design · Aerodynamics",
    where: "Gurgaon, India · 2023",
    desc: "Designed and optimized a miniature F1 car.",
    overview: "Part of the F1 in Schools engineering challenge, designing and optimizing miniature F1 car models.",
    did: [
      "Designed and optimized car models in Fusion 360",
      "Performed aerodynamic analysis",
      "Contributed to the team's engineering documentation",
    ],
    tags: ["Fusion 360", "Aerodynamics", "Documentation"],
    img: "images/f1-in-schools.jpg", gallery: [], link: "",
  },
  {
    slug: "uav-iit-delhi",
    title: "Drone & UAV Internship",
    cats: "UAV · Flight Control",
    where: "IIT Delhi · 2024",
    desc: "UAV aerodynamics, stabilization and flight control.",
    overview: "Internship at IIT Delhi focused on how drones fly and stay stable.",
    did: [
      "Learned UAV aerodynamics, stabilization systems and flight control programming",
      "Assembled and tested UAV components alongside the team",
    ],
    tags: ["UAV", "Flight Control", "Integration"],
    img: "images/uav.jpg", gallery: [], link: "",
  },
  {
    slug: "automotive-iot",
    title: "Automotive Electronics & IoT",
    cats: "Electronics · IoT",
    where: "IIT Delhi · 2024",
    desc: "Vehicle sensors, ECUs and telematics.",
    overview: "Internship at IIT Delhi on automotive electronics and connected vehicle systems.",
    did: [
      "Studied automotive sensor and ECU systems and telematics integration",
      "Built foundational IoT frameworks for vehicle data systems",
    ],
    tags: ["IoT", "Embedded", "Automotive"],
    img: "images/automotive-iot.jpg", gallery: [], link: "",
  },
  {
    slug: "solenoid-engine",
    title: "Solenoid Engine Research",
    cats: "Research · Physics",
    where: "IB Physics Extended Essay",
    desc: "AC voltage vs. oscillation in a solenoid engine.",
    overview: "My IB Physics Extended Essay investigated how AC voltage amplitude affects oscillation frequency in a fixed-field solenoid engine.",
    did: [
      "Investigated the relationship between AC voltage amplitude and oscillation frequency in a fixed-field solenoid engine",
    ],
    tags: ["Physics", "Experimental Design", "Data Analysis"],
    img: "images/solenoid-engine.jpg", gallery: [], link: "",
  },
];
