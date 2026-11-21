/* ============================================================
   CONFIGURATION — le seul fichier à modifier après le déploiement
   ============================================================ */

// Colle ici l'URL de ton application Web Google Apps Script
// (elle se termine par /exec). Tant que la valeur reste
// "VOTRE_URL_ICI", l'application fonctionne en « mode local » :
// les élèves pratiquent, mais rien n'est envoyé à la feuille Google.
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFHGei62fMCdOmznImv3gg96yKbXwq0lkag9X4SzYvhhLuqpvaM_NTgyQI8igB-pWo3g/exec";

// Nombre de questions par mode
const CONFIG = {
  questionsEntrainement: 15,
  questionsQuiz: 20,
  dureeSprintSecondes: 60,
  questionsDifficiles: 10
};
