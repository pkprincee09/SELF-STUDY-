/* Central configuration: update these values when connecting a real backend. */
window.SCHOOL_CONFIG = {
  appName: "NextOS Smart School",
  schoolName: "Sunrise Public School",
  academicYear: "2026–27",
  currency: "INR",
  locale: "en-IN",
  mode: "demo",
  // Future backend adapter settings (do not paste secret keys in frontend code).
  backend: {
    provider: "none",
    apiBaseUrl: "",
    firebaseConfig: null
  },
  modules: ["dashboard","students","teachers","classes","attendance","fees","exams","homework","timetable","transport","library","notices","reports","users","settings"]
};
