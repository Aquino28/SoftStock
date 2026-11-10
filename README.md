# SoftStock

**SoftStock** is an AI-assisted inventory monitoring and restocking web application developed for **Softbound Café**. It helps café staff monitor stock levels, record stock movements, review inventory activity, and classify written inventory observations into demand-related insights.

Developed as the **PTF50 Final Project** at **Angeles University Foundation**.

## Features

### Dashboard
- View an overview of inventory status and key stock information.
- Identify items that need attention, including low-stock and out-of-stock items.
- Review recent stock movements and AI-classified observations.

### Inventory Management
- Add, edit, and delete inventory items.
- Record stock-in and stock-out transactions with quantities and notes.
- Set minimum stock levels and optional restock targets.
- Automatically identify an item's stock status:
  - **Out of stock:** quantity is 0.
  - **Low stock:** quantity is at or below its minimum stock level.
  - **In stock:** quantity is above its minimum stock level.
- Search and filter inventory items.
- Review movement history for individual items or the inventory.
- Import and export inventory data using CSV files.

### AI Demand Insights
- Enter a written observation about an inventory item and classify it using a browser-based zero-shot text-classification model powered by **Transformers.js**.
- Classify observations into six categories:
  - Increasing demand
  - Stable demand
  - Decreasing demand
  - Frequent stockouts
  - Possible overstocking
  - Supply or delivery issues
- View the predicted category, confidence score, and a suggested action.
- Receive a low-confidence notice when the model's confidence is below the app's configured threshold.
- Review previously classified observations.

**Important:** AI suggestions are intended to support inventory monitoring. They are not automatic purchasing decisions or guaranteed predictions. Staff should review the result and use their own judgment.

## Technology

- **HTML, CSS, and JavaScript** — application structure, styling, and functionality
- **JavaScript ES modules** — separates the application into feature-specific modules
- **Transformers.js** — runs the zero-shot text-classification model in the browser
- **Xenova/mobilebert-uncased-mnli** — pretrained model used for AI observation classification
- **Browser LocalStorage** — stores inventory items, stock movements, and AI observation history locally
- **Vercel** — deployment and hosting

## Project Structure

```text
SoftStock/
├── assets/             # Logo, icons, and café imagery
├── css/
│   └── style.css       # Application styles
├── fonts/              # Local font files and font license
├── js/
│   ├── ai.js           # AI model loading and observation classification
│   ├── dashboard.js    # Dashboard, inventory, and AI Insights interface
│   ├── inventory.js    # Inventory operations and stock calculations
│   ├── main.js         # Application initialization and module connection
│   ├── seed.js         # Initial sample inventory and movement history
│   └── storage.js      # LocalStorage read/write functions
├── index.html          # Main application page
├── manifest.webmanifest
└── README.md
```

## Run Locally

The application uses JavaScript ES modules, so it must be served through a local web server. Do not open `index.html` directly from the file system.

1. Clone or download this repository.
2. Open the project folder in Visual Studio Code.
3. Install the **Live Server** extension if it is not already installed.
4. Open `index.html`.
5. Right-click the file and select **Open with Live Server**.
6. Open the local URL provided by Live Server in your browser.

An internet connection is required to download the Transformers.js model the first time AI Insights is used. The browser can cache the model for later use.

## Data Storage and Privacy

- Inventory items, stock movement records, and AI observation history are saved in the browser's **LocalStorage**.
- This means data is stored locally in the browser used to access the app; it is not automatically synchronized between different browsers or devices.
- The AI model is loaded from the jsDelivr CDN. Observation classification runs in the browser, and the AI module does not send application data to an application server.
- Clearing the browser's site data may remove locally stored SoftStock records. Export important inventory data before clearing browser data or switching devices.

## Sample Data

On the first launch, SoftStock initializes with sample café inventory items and sample stock movement records so the dashboard can be explored and demonstrated.

The sample records are demonstration data and should not be treated as Softbound Café's actual inventory. The inventory module also provides a reset-to-sample-data function for testing and demonstrations; resetting replaces the locally stored inventory and history.

## Team

| Member | Responsibility |
|---|---|
| Anne Beatriz Villanueva | Frontend / UI |
| Yerika Elaine Gueco | AI / ML integration (Transformers.js) |
| Katrine Ingrid Aquino | Inventory system and integration |

## Code Ownership

Coordinate with the relevant member before making changes to shared files.

| File | Owner |
|---|---|
| `index.html`, `css/style.css`, `js/dashboard.js` | Anne Beatriz Villanueva |
| `js/ai.js` | Yerika Elaine Gueco |
| `js/storage.js`, `js/seed.js`, `js/inventory.js` | Katrine Ingrid Aquino |
| `js/main.js` | Shared — coordinate changes first |

## Deployed Application

[https://softstock.vercel.app/](https://softstock.vercel.app/)

---

*SoftStock — PTF50 Final Project, Angeles University Foundation.*
