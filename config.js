// The Board — connection settings.
// The anon key is PUBLIC by design. It is safe in a browser.
// Never put a key starting with sb_secret_ or service_role in this file.

window.CONFIG = {
  SUPABASE_URL: 'https://zaetbfzxrqskdujvldng.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZXRiZnp4cnFza2R1anZsZG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNTM5ODAsImV4cCI6MjEwNDgyOTk4MH0.hheP9UwLTr_qEBcPOWX33qNKcYEHfiuG_-PpqBWlU1I',

  // Anyone with this code can join the group. Change it and tell your friends.
  GROUP_CODE: 'IRONGOONS',

  // Lifts that get a fixed row on everyone's PR board.
  LIFTS: ['Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-ups'],

  // Points: 1 per session, plus this bonus for hitting your weekly goal.
  GOAL_BONUS: 2
};
