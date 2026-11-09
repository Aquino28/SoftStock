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
    hypothesis: "This indicates rising customer demand, high usage, or inventory running low and depleting quickly.",
    action: "Review recent usage and consider raising the minimum stock level or restocking earlier."
  },
  {
    label: "Stable demand",
    hypothesis: "This indicates normal, steady customer demand with consistent sales and expected inventory levels.",
    action: "Keep the current restocking schedule and minimum stock level."
  },
  {
    label: "Decreasing demand",
    hypothesis: "This indicates falling customer demand, low usage, or having excess stock, surplus inventory, and more product than needed.",
    action: "Consider ordering smaller quantities or lowering the minimum stock level."
  },
  {
    label: "Supplier delivery delays",
    hypothesis: "This indicates supplier shipment issues, late deliveries, or missing orders from the vendor.",
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

function getRegexClassification(observation) {
  const text = observation.toLowerCase();
  const has = (pattern) => pattern.test(text);

  if (
    has(/\b(?:supplier|vendor)\b.*\b(?:late|delayed|missing|unreliable|failed)\b/) ||
    has(/\b(?:delivery|deliveries|shipment|shipments)\b.*\b(?:late|delayed|missing|incomplete|unreliable)\b/) ||
    has(/\b(?:late|delayed|missing|incomplete|unreliable)\b.*\b(?:delivery|deliveries|shipment|shipments)\b/)
  ) {
    return "Supplier delivery delays";
  }

  if (
    has(/\b(?:demand|sales|usage)\b.*\b(?:decreasing|declining|falling|down|lower|less|slower)\b/) ||
    has(/\b(?:decreased|declined|fell|fewer customers|selling less|buying less)\b/) ||
    has(/\b(?:overstocked|overstock|excess|surplus|too much|more of .* than .* need|more than .* need|sitting in storage|barely used|barely being used|unused|slow-moving)\b/)
  ) {
    return "Decreasing demand";
  }

  if (
    has(/\b(?:demand|sales|usage)\b.*\b(?:increasing|rising|growing|up|higher|more|faster)\b/) ||
    has(/\b(?:increased|rose|grew|more customers|selling more|buying more)\b/) ||
    has(/\b(?:out of stock|stockout|stock-outs?|ran out|running out)\b/) ||
    has(/\b(?:runs? out|running out|ran out)\b.*\b(?:customers?|demand|usage|use|faster|replenish|restock)\b/)
  ) {
    return "Increasing demand";
  }

  if (
    has(/\b(?:demand|sales|usage)\b.*\b(?:stable|steady|unchanged|consistent|same)\b/) ||
    has(/\bno change in (?:demand|sales|usage)\b/)
  ) {
    return "Stable demand";
  }

  return null;
}

function observationIndicatesShortage(observation) {
  const shortage = /\b(out of stock|stockout|stock-outs?|runs? out|running out|lack(?:s|ing)?|shortage|empty|unavailable)\b/i;
  const negatedShortage = /\b(no|not|without|never)\s+(?:any\s+)?(?:out of stock|stockouts?|stock-outs?|shortage|lack|empty|unavailable)\b/i;
  return shortage.test(observation) && !negatedShortage.test(observation);
}

function getStockWarning(item, label, observation) {
  const status = Inventory.getStatus(item);
  const warnings = [];
  const shortageInObservation = observationIndicatesShortage(observation);

  if (label === "Decreasing demand" && status !== "ok" && /\b(?:overstock|excess|surplus|unused|slow-moving|more of .* than .* need|more than .* need)\b/i.test(observation)) {
    const statusText = status === "out" ? "out of stock" : "at or below its minimum stock level";
    warnings.push(
      `The item is ${statusText}, so the decreasing-demand or overstock signal conflicts with its current inventory. Prioritize restocking instead of pausing reorders.`
    );
  }

  if (label === "Increasing demand" && status === "ok" && shortageInObservation) {
    warnings.push(
      "The item is currently above its minimum stock level, so the increasing-demand stockout signal may describe a previous or recurring condition rather than its current status."
    );
  }

  if (status === "ok" && shortageInObservation) {
    warnings.push(
      "The item currently has stock, but this note reports a shortage or stockout. Review recent usage and replenishment history before treating the item as fully resolved."
    );
  }

  if (label === "Decreasing demand" && shortageInObservation) {
    warnings.push(
      "The decreasing-demand or overstock signal conflicts with the shortage described in the observation."
    );
  }

  return warnings.length > 0 ? warnings.join(" ") : null;
}

// ---------- Main function used by dashboard.js ----------

/**
 * Classifies an observation, saves it to history, and returns:
 * { label, confidence, lowConfidence, scores[], suggestedAction, explanation, stockWarning }
 */
export async function classifyObservation(itemId, text) {
  const observation = validateObservation(itemId, text);
  const item = Inventory.getItemById(itemId);

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

  const modelTop = scores[0];
  if (!modelTop) throw new Error("The AI model returned no classification.");

  const regexLabel = getRegexClassification(observation);
  const regexCategory = regexLabel
    ? CATEGORIES.find((category) => category.label === regexLabel)
    : null;
  const top = regexCategory
    ? {
        label: regexCategory.label,
        action: regexCategory.action,
        confidence: Math.max(modelTop.confidence, 0.9)
      }
    : modelTop;
  const displayScores = regexCategory
    ? [top, ...scores.filter((score) => score.label !== top.label)]
    : scores;

  const lowConfidence = top.confidence < LOW_CONFIDENCE_THRESHOLD;
  const explanation = lowConfidence
    ? "The model is not sure about this note. Try describing what happened in more detail."
    : `The note most closely matches "${top.label}".`;
  const stockWarning = getStockWarning(item, top.label, observation);

  Inventory.saveObservation({
    itemId,
    text: observation,
    label: top.label,
    confidence: top.confidence,
    category: item.category,
    status: Inventory.getStatus(item),
    quantity: item.quantity,
    stockWarning,
    scores: displayScores.map(({ label, confidence }) => ({ label, confidence })),
    suggestedAction: top.action,
    explanation,
    lowConfidence
  });

  return {
    label: top.label,
    confidence: top.confidence,
    lowConfidence,
    scores: displayScores.map(({ label, confidence }) => ({ label, confidence })),
    suggestedAction: top.action,
    explanation,
    stockWarning,
    stockStatus: Inventory.getStatus(item),
    stockQuantity: item.quantity,
    stockCategory: item.category
  };
}