# SmartInvoice API Setup

SmartInvoice can call an AI provider directly from the frontend. Because this is a Vite app, every variable that starts with `VITE_` is included in the browser build and can be seen by users. Use frontend API keys only when that risk is acceptable.

After changing `.env`, restart the dev server.

## Gemini

```env
VITE_SMART_INVOICE_PROVIDER=gemini
VITE_SMART_INVOICE_API_KEY=your_gemini_api_key
VITE_SMART_INVOICE_MODEL=gemini-1.5-flash
```

Other useful Gemini model:

```env
VITE_SMART_INVOICE_MODEL=gemini-2.0-flash
```

## DeepSeek

```env
VITE_SMART_INVOICE_PROVIDER=deepseek
VITE_SMART_INVOICE_API_KEY=your_deepseek_api_key
VITE_SMART_INVOICE_MODEL=deepseek-chat
```

Optional custom DeepSeek-compatible endpoint:

```env
VITE_SMART_INVOICE_ENDPOINT=https://api.deepseek.com/chat/completions
```

Camera scanning also works with DeepSeek. The browser first reads the
captured patient paper with OCR, then sends the extracted text to the same
DeepSeek SmartInvoice prompt used by dictation. No extra backend setting is
required.

## OpenRouter

OpenRouter gives one API key for many models. Use free models ending in `:free` when available.

```env
VITE_SMART_INVOICE_PROVIDER=openrouter
VITE_SMART_INVOICE_API_KEY=your_openrouter_key
VITE_SMART_INVOICE_MODEL=openrouter/free
```

Useful free-model examples:

```env
VITE_SMART_INVOICE_MODEL=deepseek/deepseek-chat-v3-0324:free
VITE_SMART_INVOICE_MODEL=qwen/qwen3-14b:free
VITE_SMART_INVOICE_MODEL=mistralai/mistral-small-3.2-24b-instruct:free
```

Optional custom OpenRouter-compatible endpoint:

```env
VITE_SMART_INVOICE_ENDPOINT=https://openrouter.ai/api/v1/chat/completions
```

## Local or OpenAI-Compatible Endpoint

Use this for Ollama, LM Studio, a local proxy, or any OpenAI-compatible `/chat/completions` endpoint.

```env
VITE_SMART_INVOICE_PROVIDER=openai-compatible
VITE_SMART_INVOICE_ENDPOINT=http://localhost:11434/v1/chat/completions
VITE_SMART_INVOICE_MODEL=qwen2.5:0.5b
```

Legacy values still work:

```env
VITE_SMART_INVOICE_MODE=local
VITE_SMART_INVOICE_ENDPOINT=http://localhost:11434/v1/chat/completions
VITE_SMART_INVOICE_MODEL=qwen2.5:0.5b
```

## Expected Model Output

The model should return only JSON, with fields like:

```json
{
  "patient": {
    "firstName": "Mamadou",
    "lastName": "Traore",
    "phone": "70000000",
    "dateOfBirth": "1980-01-01",
    "gender": "Male"
  },
  "doctor": {
    "name": "Coulibaly"
  },
  "tests": [
    { "name": "NFS" },
    { "name": "CRP" }
  ],
  "hasInsurance": true,
  "discountAmount": 0,
  "amountPaid": 15000,
  "notes": ""
}
```

The app will match doctor and test names locally after the AI response.

## Camera Scan OCR

The `Scanner papier` mode uses the browser camera and Tesseract OCR.

- The browser must have camera permission.
- The app prefers the front camera and falls back to any available camera.
- After capture, OCR text appears in an editable field before AI analysis.
- With DeepSeek, only the OCR text is sent to the model; the image itself is
  not uploaded to DeepSeek.
- If OCR returns an empty result, improve lighting, retake the photo, or type
  the missing details in the OCR text field before analyzing.

## Enable or Disable SmartInvoice

Use `/settings/invoice-ai` to enable or disable the SmartInvoice button on
invoice forms. The page is protected by `settings.invoice_ai_access_code`.
Fresh setup creates the default code `AI2026`; change it directly in the
`settings` table when deploying to a real site.

## Troubleshooting

- Missing key: set `VITE_SMART_INVOICE_API_KEY` for Gemini, DeepSeek, or OpenRouter.
- Missing endpoint: set `VITE_SMART_INVOICE_ENDPOINT` for `openai-compatible`.
- CORS error: the provider may block browser calls; use a proxy or Supabase Edge Function if needed.
- Invalid API key or quota: check the provider dashboard and billing limits.
- OpenRouter free models: free quota, model names, and availability can change; try another `:free` model if one fails.
- Bad JSON response: try a smaller model prompt, a clearer invoice instruction, or a model that supports JSON output well.
- Timeout: SmartInvoice waits 45 seconds before cancelling the request.
