/** Today's date as YYYY-MM-DD in IST — matches how the backend stores attendance dates. */
export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
