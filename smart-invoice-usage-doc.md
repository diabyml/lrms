# SmartInvoice Usage Guide

SmartInvoice turns a typed or dictated instruction into a draft invoice. It extracts patient details, doctor, tests, insurance, payment options, discounts, amount paid, and notes. The draft is shown for review before it is applied.

## What You Can Say

Use natural French invoice instructions:

```text
Facture pour Awa Traore, femme, téléphone 77123456, docteur Coulibaly,
NFS et CRP, avec AMO, payé 15000.
```

```text
Patient Mamadou Diarra, homme, docteur Keita, glycémie, créatinine,
facture gratuite.
```

```text
Facture pour Fatoumata Dembélé, docteur Sangaré, NFS, demi tarif,
téléphone 66112233.
```

```text
Patient Ibrahima Coulibaly, docteur Diallo, bilan lipidique,
remise 5000, payé 10000, note: contrôle dans une semaine.
```

## Supported Fields

SmartInvoice can fill:

- Patient first name and last name.
- Patient phone.
- Patient gender: `homme`, `masculin`, `femme`, `féminin`.
- Doctor name, matched locally against saved doctors.
- Tests, matched locally against saved test types.
- AMO/insurance: phrases like `AMO`, `avec AMO`, `couvert`, `assuré`.
- Free invoice: phrases like `gratuit`, `facture gratuite`, `ne paie pas`.
- Demi tarif: phrases like `demi tarif`, `moitié`, `payer la moitié`.
- Fixed discount amount: `remise 5000`.
- Amount paid: `payé 15000`, `a payé 15000`.
- Notes: `note: ...`.

## Billing Rules

- `Facture gratuite` wins over `Demi tarif` if both are detected.
- `Facture gratuite` sets the invoice to free and paid amount to `0`.
- `Demi tarif` sets a 50% discount and defaults the paid amount to the half-total.
- Manual `remise` is applied only when the invoice is not free and not demi tarif.
- AMO affects default test prices before totals are calculated.

## Review Before Applying

After clicking `Analyser`, check:

- Patient name, phone, date of birth, and gender.
- Doctor match and confidence.
- Tests detected and selected.
- AMO, Gratuit, Demi tarif, Remise, and Payé.

You can adjust unresolved doctors/tests before applying the draft.

## Scanner Papier

Use `Scanner papier` when the details are on a patient paper:

1. Click `Démarrer caméra` and allow camera access.
2. Place the paper in front of the camera and click `Capturer`.
3. Click `Analyser la photo`.
4. Correct the OCR text if needed, then analyze again.
5. Review the detected patient, doctor, tests, and billing flags before
   applying the draft.

When DeepSeek is configured, the camera flow uses OCR first, then sends the
read text to DeepSeek. The captured image itself is not sent to DeepSeek.

## Tips

- Prefer clear test names: `NFS`, `CRP`, `glycémie`, `créatinine`.
- Say the doctor name with `docteur`.
- Say payment options clearly: `facture gratuite`, `demi tarif`, or `remise 5000`.
- If the AI misses something, make the instruction shorter and more direct.
- For scans, use good lighting and keep the paper flat in the frame.
