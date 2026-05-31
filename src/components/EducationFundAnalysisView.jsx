AUDIT v50 — Education Fund Analysis Module
תאריך: 2026-05-31
פרויקט: Consultant-report-analysis-system / דוח יועץ DASHBOARD
קובץ שנבדק: EducationFundAnalysisView_v49_MANAGER_SCOPE_MODE_BAR_FULL.txt

מסקנה מרכזית:
לא כותבים את מודול קרנות ההשתלמות מחדש. קיימת תשתית טובה ורחבה, ולכן ההמשך הנכון הוא Hardening נקודתי של הלוגיקה העסקית וה־UX, בעיקר סביב בדיקת דמי ניהול מול הסכם, איכות נתונים, והתאמת התנהגות למסך הפנסיה.

מה כבר קיים היום:
1. שכבת טעינת נתונים קיימת:
   - getEducationFundData קוראת productResults.hishtalmut / educationFund.
   - יש תמיכה ב-managerResults.
   - קיימים fallback-ים ל-unifiedRows, educationFundRows, rawRows, rowsRaw.
   - כל שורה מקבלת arrangementManagerId / arrangementManagerName / uploadManagerName.

2. נרמול שורות קיים:
   - normalizeEducationRow מאחד שדות כמו employeeCode, idNumber, issuer, manager, currentBalance, monthlyDeposit, investmentTrack, accumulationFee, accumulationFeeAgreement.
   - זה בסיס נכון להמשך ולא צריך להחליף אותו.

3. בחירת מנהל הסדר קיימת:
   - selectedManagerKey = all כבר קיים.
   - selectedRows מסתנן לפי getArrangementManagerKey.
   - v49 הוסיף כיוון נכון של בחירה בין כל מנהלי ההסדר לבין מנהל ספציפי.

4. חוצצי ניתוח קיימים:
   - דמי ניהול
   - צבירה
   - מסלולי השקעה לפי גיל
   - מנהלי השקעות / גופים מנהלים
   - עובדים עם שגיאות

5. שכבת איכות נתונים קיימת:
   - buildEducationAnalysisDataset.
   - getEducationHardValidationReasons.
   - שורות לא תקינות יוצאות מ-analysisRows ונכנסות לטאב שגיאות.

6. בדיקת מסלולים לפי גיל קיימת:
   - calculateAge.
   - classifyTrackRisk.
   - classifyAgeDesignatedTrack.
   - checkTrackAgeFit.
   - קיימת אינדיקציה עסקית בסיסית ולא רק UI.

מה חסר / דורש תיקון:
1. בדיקת דמי ניהול קיימת, אבל היא לא מספיק מדויקת עסקית.
   כרגע buildFeeAnalysis משתמש בעיקר ב:
   - accumulationFee
   - accumulationFeeAgreement
   כלומר דמי ניהול מצבירה בלבד.
   חסר טיפול מלא בדמי ניהול מהפקדה מול הסכם.

2. סיווג חריגה בדמי ניהול הוא בינארי מדי:
   - ok
   - warning
   - unknown
   יש classifyFeeSeverity, אבל צריך להציג באופן ברור:
   - תקין
   - חריגה קלה
   - חריגה מהותית
   ולוודא שהגרף משתמש באותם סטטוסים.

3. Validation כרגע מחמיר מדי:
   getEducationHardValidationReasons פוסל שורה אם חסר accumulationFeeAgreement.
   זה נכון אם רוצים לבדוק דמי ניהול, אבל לא נכון אם רוצים להכניס את העובד לניתוח צבירה או מסלולים.
   כלומר צריך להפריד בין:
   - כשירות כללית לשורה
   - כשירות לדמי ניהול
   - כשירות למסלולים
   - כשירות לצבירה

4. טאב שגיאות מערבב בין שגיאות קשיחות לבין חריגות עסקיות:
   עובד עם חריגת דמי ניהול הוא לא בהכרח "שורת נתונים שגויה".
   צריך להפריד בתצוגה בין:
   - חסר נתון / שורה לא כשירה
   - חריגה דמי ניהול
   - בדיקת מסלול דורשת סקירה

5. במבט 'כל מנהלי ההסדר' קיימת מגבלה נכונה שלא להציג רשימות עובדים, אבל צריך לוודא שכל החוצצים באמת מתנהגים כך:
   - כללי = אגרגציה בלבד
   - מנהל ספציפי = Drill Down עובד/שורה

6. עדיין צריך לוודא שה־Manager Scope Bar נראה ומתנהג זהה למסך הפנסיה:
   - כפתור כל מנהלי ההסדר
   - כפתור מנהל ספציפי
   - dropdown רק במצב מנהל ספציפי
   - טקסט מלווה ברור

המלצת פעולה מיידית:
שלב v50 לא אמור להיות פיתוח מחדש.
הפעולה הנכונה היא:

v50 — Education Fee Engine Hardening
מטרה:
לחזק את טאב דמי הניהול בלי לשבור את שאר החוצצים.

מה לבצע:
1. להרחיב normalizeEducationRow כך שיתמוך גם בשדות:
   - depositFee
   - depositFeeAgreement
   - contributionFee
   - contributionFeeAgreement
   - managementFeeDeposit
   - managementFeeDepositAgreement
   בנוסף ל־accumulationFee / accumulationFeeAgreement.

2. לבנות פונקציה אחת:
   buildEducationFeeComparison(row)
   שתחזיר:
   - actualAccumulationFee
   - agreementAccumulationFee
   - accumulationGap
   - actualDepositFee
   - agreementDepositFee
   - depositGap
   - worstGap
   - feeStatus: ok / lightWarning / warning / unknown
   - reasons
   - estimatedAnnualGapCost

3. לשנות את buildFeeAnalysis כך שישתמש בפונקציה החדשה.

4. לעדכן את טאב דמי הניהול להצגת שני סוגי דמי ניהול:
   - מצבירה
   - מהפקדה

5. לא לגעת עדיין בטאבים האחרים, חוץ מהתאמות מינימליות שלא יפגעו ב־build.

המלצה להמשך אחרי v50:
- v51: הפרדת Data Quality לפי סוג ניתוח ולא פסילה גלובלית אחת.
- v52: חיזוק מסלולי השקעה לפי גיל.
- v53: טאב שגיאות חדש שמפריד בין חסרי נתונים לבין חריגות עסקיות.

כללי עבודה:
- לא לבצע Rewrite.
- לא לשנות ארכיטקטורה קיימת.
- לא לשנות UX כללי בלי צורך.
- כל שינוי בקובץ מלא TXT להורדה.
- לאחר כל שינוי להריץ npm run build.
