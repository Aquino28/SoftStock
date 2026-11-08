// ============================================================
// ai.js (Owner: Member 2)
// Purpose: Classify café inventory observations in the browser.
//
// The model is downloaded from the Hugging Face CDN the first time
// the user classifies an observation, then cached by the browser.
// No application data is sent to a server by this module.
// ============================================================

import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
import * as Inventory from "./inventory.js";

export const MODEL_NAME = "Xenova/mobilebert-uncased-mnli";

// Keep labels short and distinct so the NLI model can compare them reliably.
export const CLASSIFICATION_CATEGORIES = [
  "Increasing demand",
  "Stable demand",
  "Decreasing demand",
  "Frequent stockouts",
  "Possible overstocking",
  "Supply or delivery issues"
];

let classifierPromise;

function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline("zero-shot-classification", MODEL_NAME);
  }
  return classifierPromise;
}

function validateObservation(itemId, text) {
  if (!Inventory.getItemById(itemId)) {
    throw new Error("Cannot classify observation: item not found.");
  }

  const observation = String(text ?? "").trim();
  if (!observation) {
    throw new Error("Observation text is required.");
  }
  if (observation.length > 400) {
    throw new Error("Observation must be 400 characters or fewer.");
  }
  return observation;
}

function asConfidence(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 1);
}

function formatScore(label, score) {
  return `${label}: ${Math.round(score * 100)}%`;
}

/**
 * Classifies an inventory observation and saves it to inventory history.
 *
 * @param {string} itemId The inventory item associated with the observation.
 * @param {string} text A short café inventory observation.
 * @returns {Promise<{
 *   label: string,
 *   confidence: number,
 *   scores: Array<{label: string, confidence: number}>,
 *   explanation: string
 * }>}
 */
export async function classifyObservation(itemId, text) {
  const observation = validateObservation(itemId, text);

  let result;
  try {
    const model = await getClassifier();
    result = await model(observation, CLASSIFICATION_CATEGORIES, {
      multi_label: false
    });
  } catch (error) {
    classifierPromise = undefined;
    const message = error instanceof Error ? error.message : "Unknown model error.";
    throw new Error(`The AI model could not run. Check your internet connection and try again. ${message}`);
  }

  const scores = result.labels.map((label, index) => ({
    label,
    confidence: asConfidence(result.scores[index])
  }));
  const top = scores[0];

  if (!top) {
    throw new Error("The AI model returned no classification.");
  }

  const explanation = `Compared ${scores.length} inventory categories. ${scores
    .map((score) => formatScore(score.label, score.confidence))
    .join(" | ")}`;

  Inventory.saveObservation({
    itemId,
    text: observation,
    label: top.label,
    confidence: top.confidence
  });

  return {
    label: top.label,
    confidence: top.confidence,
    scores,
    explanation
  };
}
