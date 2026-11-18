export function getPatientAgeGroup(dob: string): string {
  const [year, month, day] = dob.split("-").map(Number);
  if (!year || !month || !day) return "Age unavailable";

  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayHasPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayHasPassed) age -= 1;

  if (age < 0) return "Age unavailable";
  if (age < 2) return "Infant";
  if (age <= 3) return "Toddler";
  if (age <= 12) return "Child";
  if (age <= 17) return "Teen";
  if (age >= 60) return "Senior";
  return "Adult";
}
