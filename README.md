# FraudShield

FraudShield is a synthetic, hackathon-ready telecom fraud-defense demo. Its core story is a live phishing-to-SIM-swap-to-mule attack chain that is correlated into explainable risk, a Fraud DNA timeline, graph relationships, protective actions, and an investigation record.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. The API listens at `http://localhost:8787` and is proxied by Vite during development.

The application works in fully deterministic demo mode without credentials. To enable live, authorized test notifications, provide `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`, and `AT_VOICE_NUMBER` in `.env`. Never place those values in a `VITE_` variable or commit them. The optional AI Analyst supports an OpenAI-compatible endpoint through `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`; it falls back to structured, evidence-grounded advice when unavailable.

## Demo flow

1. Open **Attack Simulator** and select **Run Full Attack**.
2. Watch the event chain update the live risk score, Fraud DNA, graph and response state.
3. Open **Investigations** to apply a temporary hold and record the audit event.
4. Switch to **Customer** and select **This wasn't me** to trigger a protected-state notification flow.
5. Ask the **AI Analyst** why the account was flagged.

All customers, phone numbers, transaction values and risk signals are synthetic. FraudShield identifies potential risk and recommends investigation; it does not determine that an individual committed fraud.
