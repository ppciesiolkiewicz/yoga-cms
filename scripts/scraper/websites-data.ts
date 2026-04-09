import type { StudioEntry } from "./types"

export const studios: StudioEntry[] = [
  // ── Rishikesh, India ──────────────────────────────────────────

  {
    studioName: "Yin Yoga Foundation",
    city: "Rishikesh",
    website: "https://www.yinyogafoundation.com",
    dropIns: [],
    trainings: [
      { url: "https://www.yinyogafoundation.com/50-hour-yin-yoga-teacher-training-rishikesh.php" },
      { url: "https://www.yinyogafoundation.com/yin-yoga-certification.php" },
      { url: "https://www.yinyogafoundation.com/200-hour-yin-yoga-teacher-training-rishikesh.php" },
    ],
    retreats: [],
    contact: { url: "https://www.yinyogafoundation.com/contact.php" },
  },

  {
    studioName: "Himalayan Yoga Association",
    city: "Rishikesh",
    website: "https://www.himalayanyogaashram.com",
    dropIns: [],
    trainings: [
      { url: "https://www.himalayanyogaashram.com/yin-yoga-teacher-training-in-rishikesh/", scrapeMode: "browser" },
      { url: "https://www.himalayanyogaashram.com/200-hour-yin-yoga-teacher-training-in-rishikesh-india/", scrapeMode: "browser" },
      { url: "https://www.himalayanyogaashram.com/300-hour-yin-yoga-teacher-training-in-rishikesh-india/", scrapeMode: "browser" },
    ],
    retreats: [],
    contact: { url: "https://www.himalayanyogaashram.com/contact-us/", scrapeMode: "browser" },
  },

  {
    studioName: "Arogya Yoga School",
    city: "Rishikesh",
    website: "https://www.arogyayogaschool.com",
    dropIns: [
      { url: "https://www.arogyayogaschool.com/drop-in-yoga-class-in-rishikesh.php" },
    ],
    trainings: [
      { url: "https://www.arogyayogaschool.com/50-hour-yin-yoga-teacher-training-in-rishikesh.php" },
      { url: "https://www.arogyayogaschool.com/200-hour-yin-yoga-teacher-training-in-rishikesh.php" },
      { url: "https://www.arogyayogaschool.com/200-hour-yoga-teacher-training-course-in-india.php" },
    ],
    retreats: [
      { url: "https://www.arogyayogaschool.com/yoga-retreats-in-rishikesh-india.php" },
    ],
    contact: { url: "https://www.arogyayogaschool.com/contact.php" },
  },

  // ── Wroclaw, Poland ───────────────────────────────────────────

  {
    studioName: "Doinyoga",
    city: "Wroclaw",
    website: "https://doinyoga.pl",
    dropIns: [
      { url: "https://doinyoga.pl/yoga-in-english-wroclaw-online/" },
    ],
    trainings: [],
    retreats: [
      { url: "https://doinyoga.pl/wyjazdy-jogowe/" },
    ],
    contact: { url: "https://doinyoga.pl/kontakt/" },
  },

  {
    studioName: "Manomani",
    city: "Wroclaw",
    website: "https://manomani.pl",
    dropIns: [
      { url: "https://manomani.pl/grafik-3/" },
    ],
    trainings: [],
    retreats: [
      { url: "https://manomani.pl/terminarz/" },
    ],
    contact: { url: "https://manomani.pl/kontakt/" },
  },

  {
    studioName: "Aydu Yoga",
    city: "Wroclaw",
    website: "https://www.ayduyoga.com",
    dropIns: [
      { url: "https://www.ayduyoga.com/classes/", scrapeMode: "browser" },
      { url: "https://www.ayduyoga.com/pl/harmonogram/", scrapeMode: "browser" },
    ],
    trainings: [],
    retreats: [
      { url: "https://www.ayduyoga.com/pl/listopadowy-aydu-retreat/", scrapeMode: "browser" },
    ],
    contact: { url: "https://www.ayduyoga.com/#contact", scrapeMode: "browser" },
  },

  {
    studioName: "Fabryka Energii",
    city: "Wroclaw",
    website: "https://fabrykaenergii.pl",
    dropIns: [
      { url: "https://fabrykaenergii.pl/zajecia-jogi-wroclaw/" },
    ],
    trainings: [
      { url: "https://fabrykaenergii.pl/kurs-jogi-dla-poczatkujacych/" },
    ],
    retreats: [
      { url: "https://fabrykaenergii.pl/wyjazdy-z-joga/" },
    ],
    contact: { url: "https://fabrykaenergii.pl/kontakt/" },
  },

  {
    studioName: "Ashtanga Yoga Wroclaw",
    city: "Wroclaw",
    website: "https://ashtangayoga.com.pl",
    dropIns: [
      { url: "https://ashtangayoga.com.pl/grafik-zajec/" },
    ],
    trainings: [
      { url: "https://ashtangayoga.com.pl/kurs-nauczycielski-jogi/" },
    ],
    retreats: [
      { url: "https://ashtangayoga.com.pl/wydarzenia/" },
    ],
    contact: { url: "https://ashtangayoga.com.pl/kontakt/" },
  },

  {
    studioName: "Namaste Wroclaw",
    city: "Wroclaw",
    website: "https://www.joganamaste.pl",
    dropIns: [
      { url: "https://www.joganamaste.pl/plan_zajec" },
    ],
    trainings: [
      { url: "https://www.joganamaste.pl/szkolenia" },
    ],
    retreats: [],
    contact: { url: "https://www.joganamaste.pl/kontakt" },
  },

  // ── Warszawa, Poland ──────────────────────────────────────────

  {
    studioName: "Yoga Republic",
    city: "Warszawa",
    website: "https://www.yogarepublic.pl",
    dropIns: [
      { url: "https://www.yogarepublic.pl/schedule" },
      { url: "https://www.yogarepublic.pl/grafik" },
    ],
    trainings: [
      { url: "https://www.yogarepublic.pl/szkolenia-dla-nauczycieli-jogi" },
    ],
    retreats: [
      { url: "https://www.yogarepublic.pl/warsztaty" },
    ],
    contact: { url: "https://www.yogarepublic.pl/kontakt" },
  },

  {
    studioName: "YogiTribe",
    city: "Warszawa",
    website: "https://www.yogitribe.life",
    dropIns: [
      { url: "https://www.yogitribe.life/class-schedules", scrapeMode: "browser" },
    ],
    trainings: [],
    retreats: [
      { url: "https://www.yogitribe.life/events", scrapeMode: "browser" },
    ],
    contact: { url: "https://www.yogitribe.life/contact", scrapeMode: "browser" },
  },

  {
    studioName: "iJoga",
    city: "Warszawa",
    website: "https://ijoga.pl",
    dropIns: [
      { url: "https://ijoga.pl/en/schedule" },
    ],
    trainings: [],
    retreats: [],
    contact: { url: "https://ijoga.pl/en/contact" },
  },

  {
    studioName: "Samadhi Joga",
    city: "Warszawa",
    website: "https://samadhijoga.pl",
    dropIns: [
      { url: "https://samadhijoga.pl/o-nas/opis-zajec" },
    ],
    trainings: [
      { url: "https://samadhijoga.pl/szkolenia-nauczycielskie/szkolenie-ryt-200" },
      { url: "https://samadhijoga.pl/szkolenia-nauczycielskie/szkolenie-yin-joga-70h" },
    ],
    retreats: [
      { url: "https://samadhijoga.pl/wyjazdy" },
      { url: "https://samadhijoga.pl/warsztaty" },
    ],
    contact: { url: "https://samadhijoga.pl/kontakt" },
  },

  {
    studioName: "Joga Foksal",
    city: "Warszawa",
    website: "https://jogafoksal.pl",
    dropIns: [
      { url: "https://jogafoksal.pl/plan-zajec/" },
    ],
    trainings: [
      { url: "https://jogafoksal.pl/akademia-jogi-i-harmonijnego-rozwoju/" },
    ],
    retreats: [
      { url: "https://jogafoksal.pl/wydarzenia/" },
    ],
    contact: { url: "https://jogafoksal.pl/kontakt/" },
  },

  // ── Berlin, Germany ───────────────────────────────────────────

  {
    studioName: "Sivananda Yoga Berlin",
    city: "Berlin",
    website: "https://berlin.sivananda.yoga",
    dropIns: [
      { url: "https://berlin.sivananda.yoga/en/", scrapeMode: "browser" },
    ],
    trainings: [
      { url: "https://berlin.sivananda.yoga/yogalehrer-ausbildung/", scrapeMode: "browser" },
    ],
    retreats: [
      { url: "https://berlin.sivananda.yoga/yoga-retreats/", scrapeMode: "browser" },
    ],
  },

  {
    studioName: "SHA-LA Studios",
    city: "Berlin",
    website: "https://www.shalastudios.com",
    dropIns: [
      { url: "https://www.shalastudios.com/schedule", scrapeMode: "browser" },
    ],
    trainings: [
      { url: "https://www.shalastudios.com/200hteachertraining", scrapeMode: "browser" },
      { url: "https://www.shalastudios.com/yinteachertraining", scrapeMode: "browser" },
    ],
    retreats: [
      { url: "https://www.shalastudios.com/retreats-1", scrapeMode: "browser" },
    ],
    contact: { url: "https://www.shalastudios.com/contact", scrapeMode: "browser" },
  },

  {
    studioName: "Three Boons Yoga",
    city: "Berlin",
    website: "https://www.threeboonsyoga.de",
    dropIns: [
      { url: "https://www.threeboonsyoga.de/classdescription", scrapeMode: "browser" },
      { url: "https://www.threeboonsyoga.de/classesmitte", scrapeMode: "browser" },
      { url: "https://www.threeboonsyoga.de/classeskreuzberg", scrapeMode: "browser" },
    ],
    trainings: [
      { url: "https://www.threeboonsyoga.de/training", scrapeMode: "browser" },
    ],
    retreats: [
      { url: "https://www.threeboonsyoga.de/retreats", scrapeMode: "browser" },
    ],
    contact: { url: "https://www.threeboonsyoga.de/contact", scrapeMode: "browser" },
  },

  {
    studioName: "Lotos Yoga Berlin",
    city: "Berlin",
    website: "https://www.yoga-lotos.de",
    dropIns: [
      { url: "https://yoga-lotos.de/classes/", scrapeMode: "browser" },
      { url: "https://yoga-lotos.de/prices/", scrapeMode: "browser" },
    ],
    trainings: [
      { url: "https://yoga-lotos.de/academy/", scrapeMode: "browser" },
    ],
    retreats: [],
  },

  {
    studioName: "Peace Yoga Berlin",
    city: "Berlin",
    website: "https://peaceyoga.de",
    dropIns: [
      { url: "https://peaceyoga.de/en/yoga-courses/timetable/" },
    ],
    trainings: [
      { url: "https://peaceyoga.de/en/yoga-teacher-training-course/" },
      { url: "https://peaceyoga.de/en/yoga-teacher-training-course/75-hours/" },
    ],
    retreats: [
      { url: "https://peaceyoga.de/en/yoga-retreats-workshops-berlin/" },
    ],
    contact: { url: "https://peaceyoga.de/en/contact/" },
  },

  {
    studioName: "YOGA SKY",
    city: "Berlin",
    website: "https://yoga-sky.de",
    dropIns: [
      { url: "https://yoga-sky.de/kursplan/" },
    ],
    trainings: [
      { url: "https://yoga-sky.de/ausbildungen/" },
      { url: "https://yoga-sky.de/vinyasa-yogalehrer-ausbildung-200h/" },
    ],
    retreats: [
      { url: "https://yoga-sky.de/retreats-2/" },
      { url: "https://yoga-sky.de/workshops/" },
    ],
  },

  // ── Melbourne, Australia ──────────────────────────────────────

  {
    studioName: "Australian Yoga Academy",
    city: "Melbourne",
    website: "https://australianyogaacademy.com",
    dropIns: [
      { url: "https://australianyogaacademy.com/timetable/" },
      { url: "https://australianyogaacademy.com/pricing/" },
    ],
    trainings: [
      { url: "https://australianyogaacademy.com/yoga-teacher-training/" },
      { url: "https://australianyogaacademy.com/training/yoga-teacher-training-200hr-diploma/" },
      { url: "https://australianyogaacademy.com/training/yoga-teacher-training-350hr-advanced-diploma/" },
    ],
    retreats: [
      { url: "https://australianyogaacademy.com/events/" },
    ],
    contact: { url: "https://australianyogaacademy.com/contact/" },
  },

  {
    studioName: "MOVE Yoga",
    city: "Melbourne",
    website: "https://www.moveyoga.com.au",
    dropIns: [
      { url: "https://www.moveyoga.com.au/timetable", scrapeMode: "browser" },
      { url: "https://www.moveyoga.com.au/classes", scrapeMode: "browser" },
      { url: "https://www.moveyoga.com.au/prices", scrapeMode: "browser" },
    ],
    trainings: [
      { url: "https://www.moveyoga.com.au/yoga-teacher-training", scrapeMode: "browser" },
    ],
    retreats: [],
  },

  {
    studioName: "Gertrude Street Yoga",
    city: "Melbourne",
    website: "https://gertrudestreetyoga.com.au",
    dropIns: [
      { url: "https://gertrudestreetyoga.com.au/timetable/" },
      { url: "https://gertrudestreetyoga.com.au/yoga-class-prices/" },
    ],
    trainings: [
      { url: "https://gertrudestreetyoga.com.au/200-hour-training/" },
      { url: "https://gertrudestreetyoga.com.au/300-hour-teacher-training/" },
    ],
    retreats: [
      { url: "https://gertrudestreetyoga.com.au/workshops/" },
    ],
    contact: { url: "https://gertrudestreetyoga.com.au/contact/" },
  },

  {
    studioName: "Moksha Yoga",
    city: "Melbourne",
    website: "https://www.mokshayoga.com.au",
    dropIns: [
      { url: "https://www.mokshayoga.com.au/full-schedule/" },
    ],
    trainings: [
      { url: "https://www.mokshayoga.com.au/yoga-teacher-training/" },
      { url: "https://www.mokshayoga.com.au/yin-yoga-teacher-training/" },
      { url: "https://www.mokshayoga.com.au/meditation-teacher-training/" },
    ],
    retreats: [
      { url: "https://www.mokshayoga.com.au/koh-samui-retreat/" },
    ],
    contact: { url: "https://www.mokshayoga.com.au/contact/" },
  },

  // ── Sydney, Australia ─────────────────────────────────────────

  {
    studioName: "InYoga",
    city: "Sydney",
    website: "https://inyoga.com.au",
    dropIns: [
      { url: "https://inyoga.com.au/about-us/timetable" },
      { url: "https://inyoga.com.au/membership" },
    ],
    trainings: [
      { url: "https://inyoga.com.au/teacher-training" },
      { url: "https://inyoga.com.au/teacher-training/course-dates" },
    ],
    retreats: [
      { url: "https://inyoga.com.au/retreats" },
    ],
    contact: { url: "https://inyoga.com.au/contact" },
  },

  {
    studioName: "BodyMindLife Academy",
    city: "Sydney",
    website: "https://academy.bodymindlife.com",
    dropIns: [],
    trainings: [
      { url: "https://academy.bodymindlife.com/yoga-teacher-training", scrapeMode: "browser" },
      { url: "https://academy.bodymindlife.com/pilates-teacher-training", scrapeMode: "browser" },
    ],
    retreats: [],
  },

  {
    studioName: "The Yoga Institute Sydney",
    city: "Sydney",
    website: "https://yogainstitute.com.au",
    dropIns: [
      { url: "https://yogainstitute.com.au/cammeray-yoga/" },
    ],
    trainings: [
      { url: "https://yogainstitute.com.au/yoga-teacher-training-2/" },
    ],
    retreats: [
      { url: "https://yogainstitute.com.au/retreats/" },
    ],
    contact: { url: "https://yogainstitute.com.au/contact/" },
  },

  {
    studioName: "HUM Studio",
    city: "Sydney",
    website: "https://www.humstudio.com.au",
    dropIns: [
      { url: "https://www.humstudio.com.au/hum-classes", scrapeMode: "browser" },
      { url: "https://www.humstudio.com.au/pricing", scrapeMode: "browser" },
    ],
    trainings: [
      { url: "https://www.humstudio.com.au/humtrainings", scrapeMode: "browser" },
      { url: "https://www.humstudio.com.au/yin-ytt", scrapeMode: "browser" },
    ],
    retreats: [
      { url: "https://www.humstudio.com.au/retreats", scrapeMode: "browser" },
    ],
    contact: { url: "https://www.humstudio.com.au/contact-us", scrapeMode: "browser" },
  },

  // ── Barcelona, Spain ──────────────────────────────────────────

  {
    studioName: "Yoga Weeks",
    city: "Barcelona",
    website: "https://www.yogaweeks.com",
    dropIns: [
      { url: "https://www.yogaweeks.com/yoga-at-yw-rooftop/" },
    ],
    trainings: [
      { url: "https://www.yogaweeks.com/200-hours-teacher-training-barcelona/" },
      { url: "https://www.yogaweeks.com/500-hours-teacher-training-barcelona/" },
      { url: "https://www.yogaweeks.com/50-hours-yoga-alliance-yin-yoga-anatomy-training/" },
    ],
    retreats: [
      { url: "https://www.yogaweeks.com/yoga-retreat-spain/" },
      { url: "https://www.yogaweeks.com/yoga-weeks-barcelona-retreats/" },
    ],
    contact: { url: "https://www.yogaweeks.com/contact/" },
  },

  {
    studioName: "Hot Yoga Barcelona",
    city: "Barcelona",
    website: "https://www.hotyogabarcelona.com",
    dropIns: [
      { url: "https://www.hotyogabarcelona.com/schedule", scrapeMode: "browser" },
      { url: "https://www.hotyogabarcelona.com/classes", scrapeMode: "browser" },
      { url: "https://www.hotyogabarcelona.com/prices", scrapeMode: "browser" },
    ],
    trainings: [
      { url: "https://www.hotyogabarcelona.com/teacher-training", scrapeMode: "browser" },
    ],
    retreats: [
      { url: "https://www.hotyogabarcelona.com/yoga-retreat-spain", scrapeMode: "browser" },
    ],
    contact: { url: "https://www.hotyogabarcelona.com/contact", scrapeMode: "browser" },
  },

  {
    studioName: "Hara Yoga Barcelona",
    city: "Barcelona",
    website: "https://en.harayogabarcelona.com",
    dropIns: [
      { url: "https://en.harayogabarcelona.com/horariosharayoga", scrapeMode: "browser" },
      { url: "https://en.harayogabarcelona.com/clases-de-yoga", scrapeMode: "browser" },
      { url: "https://en.harayogabarcelona.com/bonosyclasessueltas", scrapeMode: "browser" },
    ],
    trainings: [
      { url: "https://en.harayogabarcelona.com/formaciones", scrapeMode: "browser" },
    ],
    retreats: [
      { url: "https://en.harayogabarcelona.com/retiros", scrapeMode: "browser" },
    ],
    contact: { url: "https://en.harayogabarcelona.com/contacto", scrapeMode: "browser" },
  },

  {
    studioName: "YogaOne Surya",
    city: "Barcelona",
    website: "https://www.yogaonesurya.com",
    dropIns: [
      { url: "https://www.yogaonesurya.com/es/clases-de-yoga/" },
    ],
    trainings: [
      { url: "https://www.yogaonesurya.com/es/formaciones-yoga/" },
      { url: "https://www.yogaonesurya.com/es/formacion-profesor-yoga-ropec/" },
    ],
    retreats: [
      { url: "https://www.yogaonesurya.com/es/retiros-de-yoga/" },
    ],
    contact: { url: "https://www.yogaonesurya.com/es/contacto/" },
  },

  {
    studioName: "Yoga & Yoga Barcelona",
    city: "Barcelona",
    website: "https://yoga-yogabcn.com",
    dropIns: [
      { url: "https://yoga-yogabcn.com/horarios-yoga-barcelona/" },
      { url: "https://yoga-yogabcn.com/precios-yoga/" },
    ],
    trainings: [
      { url: "https://yoga-yogabcn.com/formacion-yoga-barcelona/" },
    ],
    retreats: [],
    contact: { url: "https://yoga-yogabcn.com/contacto/" },
  },

  // ── Paris, France ─────────────────────────────────────────────

  {
    studioName: "The Space Yoga",
    city: "Paris",
    website: "https://thespaceparis.com",
    dropIns: [
      { url: "https://thespaceparis.com/schedule/" },
      { url: "https://thespaceparis.com/class-styles/" },
      { url: "https://thespaceparis.com/prices/" },
    ],
    trainings: [
      { url: "https://thespaceparis.com/trainings/" },
      { url: "https://thespaceparis.com/vinyasa-yoga-training-26/" },
      { url: "https://thespaceparis.com/yin-training/" },
    ],
    retreats: [
      { url: "https://thespaceparis.com/workshops-and-events/" },
    ],
    contact: { url: "https://thespaceparis.com/contact/" },
  },

  {
    studioName: "Ashtanga Yoga Paris",
    city: "Paris",
    website: "https://www.ashtangayogaparis.fr",
    dropIns: [
      { url: "https://www.ashtangayogaparis.fr/schedule/" },
      { url: "https://www.ashtangayogaparis.fr/prices/" },
    ],
    trainings: [
      { url: "https://www.ashtangayogaparis.fr/formation-yoga-paris/formation-vinyasa-yoga/" },
    ],
    retreats: [
      { url: "https://www.ashtangayogaparis.fr/yoga-retreats/" },
      { url: "https://www.ashtangayogaparis.fr/workshops/" },
    ],
    contact: { url: "https://www.ashtangayogaparis.fr/contact-us/" },
  },

  {
    studioName: "YUJ Yoga Studio",
    city: "Paris",
    website: "https://www.yujparis.com",
    dropIns: [
      { url: "https://www.yujparis.com/en/pages/studios", scrapeMode: "browser" },
      { url: "https://www.yujparis.com/en/pages/tarifs", scrapeMode: "browser" },
    ],
    trainings: [
      { url: "https://www.yujparis.com/en/pages/yoga-200h", scrapeMode: "browser" },
    ],
    retreats: [],
    contact: { url: "https://www.yujparis.com/en/pages/contact?lang=en", scrapeMode: "browser" },
  },

  {
    studioName: "Jivamukti Yoga Paris",
    city: "Paris",
    website: "https://www.jivamuktiyoga.fr",
    dropIns: [
      { url: "https://www.jivamuktiyoga.fr/schedule/" },
    ],
    trainings: [
      { url: "https://www.jivamuktiyoga.fr/teacher-training/" },
    ],
    retreats: [],
  },

  {
    studioName: "YAY Yoga",
    city: "Paris",
    website: "https://www.yay-yoga.com",
    dropIns: [
      { url: "https://www.yay-yoga.com/planning/" },
      { url: "https://www.yay-yoga.com/les-cours/" },
    ],
    trainings: [
      { url: "https://www.yay-yoga.com/formation-professeur-yoga-paris/" },
      { url: "https://www.yay-yoga.com/formation-200h-professeur-de-vinyasa-yoga/" },
      { url: "https://www.yay-yoga.com/formation-200h-professeur-de-hatha-yoga/" },
    ],
    retreats: [
      { url: "https://www.yay-yoga.com/stage-yoga/" },
    ],
    contact: { url: "https://www.yay-yoga.com/yay-studios/contactez-nous/" },
  },
]
