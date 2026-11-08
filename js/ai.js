// ============================================================
// ai.js (Owner: Member 2)
// Purpose: Classify café inventory observations in the browser.
//
// The model is downloaded from the Hugging Face CDN the first time
// the user classifies an observation, then cached by the browser.
// No application data is sent to a server by this module.
// ============================================================
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
import * as Inventory from "./inventory.js";

// FIX #2: never look for model files on our own server; use the Hugging Face CDN only.
env.allowLocalModels = false;

export const MODEL_NAME = "Xenova/mobilebert-uncased-mnli";

// Results below this score are flagged as "low confidence" in the UI.
// (Scores are spread over 6 labels, so 35% is already well above random guessing at ~17%.)
export const LOW_CONFIDENCE_THRESHOLD = 0.35;

// FIX #1: each category has
//   label      -> what the owner sees
//   hypothesis -> full sentence the NLI model actually tests against the observation
//   action     -> rule-based suggestion shown to the owner (this part is NOT AI)
const CATEGORIES = [
  {
    label: "Increasing demand",
    hypothesis: "Customers are buying more of this product than before.",
    action: "Review recent usage and consider raising the minimum stock level or restocking earlier."
  },
  {
    label: "Stable demand",
    hypothesis: "Customer demand for this product is steady and unchanged.",
    action: "Keep the current restocking schedule and minimum stock level."
  },
  {
    label: "Decreasing demand",
    hypothesis: "Customers are buying less of this product than before.",
    action: "Consider ordering smaller quantities or lowering the minimum stock level."
  },
  {
    label: "Frequent stockouts",
    hypothesis: "This product keeps running out of stock.",
    action: "Raise the minimum stock level and check how often deliveries arrive."
  },
  {
    label: "Possible overstocking",
    hypothesis: "We have more of this product than we need.",
    action: "Pause reordering and check expiry dates or storage space."
  },
  {
    label: "Supply or delivery issues",
    hypothesis: "Deliveries of this product from the supplier are late or unreliable.",
    action: "Contact the supplier and consider keeping a larger safety stock."
  }
];

// Kept for any file that imports the plain list of labels.
export const CLASSIFICATION_CATEGORIES = CATEGORIES.map((c) => c.label);

// ---------- Model loading ----------

let classifierPromise;

function getClassifier(onStatus) {
  if (!classifierPromise) {
    classifierPromise = pipeline("zero-shot-classification", MODEL_NAME, {
      // FIX #3: report download progress to the UI
      progress_callback: (p) => {
        if (onStatus && p.status === "progress" && Number.isFinite(p.progress)) {
          onStatus(`Downloading AI model… ${Math.round(p.progress)}%`);
        }
      }
    });
  }
  return classifierPromise;
}

/**
 * Starts loading the model early (e.g. when the AI tab opens) so the first
 * "Classify" click is fast. Never throws; reports problems through onStatus.
 */
export async function preloadModel(onStatus = () => {}) {
  try {
    onStatus("Loading AI model…");
    await getClassifier(onStatus);
    onStatus("AI model ready.");
  } catch (error) {
    classifierPromise = undefined; // allow a retry
    onStatus("AI model could not load. Check your internet connection.");
  }
}

// ---------- Helpers ----------

function validateObservation(itemId, text) {
  if (!Inventory.getItemById(itemId)) {
    throw new Error("Cannot classify observation: item not found.");
  }
  const observation = String(text ?? "").trim();
  if (!observation) throw new Error("Observation text is required.");
  if (observation.length > 400) throw new Error("Observation must be 400 characters or fewer.");
  return observation;
}

function asConfidence(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 1);
}

// ---------- Main function used by dashboard.js ----------

/**
 * Classifies an observation, saves it to history, and returns:
 * { label, confidence, lowConfidence, scores[], suggestedAction, explanation }
 */
export async function classifyObservation(itemId, text) {
  const observation = validateObservation(itemId, text);

  let result;
  try {
    const model = await getClassifier();
    result = await model(observation, CATEGORIES.map((c) => c.hypothesis), {
      hypothesis_template: "{}", // our hypotheses are already full sentences
      multi_label: false
    });
  } catch (error) {
    classifierPromise = undefined; // allow retry next time
    const message = error instanceof Error ? error.message : "Unknown model error.";
    throw new Error(`The AI model could not run. Check your internet connection and try again. ${message}`);
  }

  // Map the model's sentence labels back to our display labels (sorted best first).
  const scores = result.labels
    .map((hypothesis, index) => {
      const category = CATEGORIES.find((c) => c.hypothesis === hypothesis);
      return category
        ? { label: category.label, action: category.action, confidence: asConfidence(result.scores[index]) }
        : null;
    })
    .filter(Boolean);

  const top = scores[0];
  if (!top) throw new Error("The AI model returned no classification.");

  const lowConfidence = top.confidence < LOW_CONFIDENCE_THRESHOLD;
  const explanation = lowConfidence
    ? "The model is not sure about this note. Try describing what happened in more detail."
    : `The note most closely matches "${top.label}".`;

  Inventory.saveObservation({
    itemId,
    text: observation,
    label: top.label,
    confidence: top.confidence
  });

  return {
    label: top.label,
    confidence: top.confidence,
    lowConfidence,
    scores: scores.map(({ label, confidence }) => ({ label, confidence })),
    suggestedAction: top.action,
    explanation
  };
}