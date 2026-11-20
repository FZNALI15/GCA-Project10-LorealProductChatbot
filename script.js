/* ==========================================
   L'ORÉAL SMART ROUTINE & PRODUCT ADVISOR
   Project 9 - Global Career Accelerator
   ========================================== */

// Cloudflare Worker endpoint
const WORKER_URL =
  "https://lorealroutinebuilder.faizanwagpura.workers.dev/";

// DOM elements
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelection = document.getElementById("clearSelection");
const generateRoutineBtn = document.getElementById("generateRoutine");

const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// Application state
let allProducts = [];
let selectedProducts = [];
let conversationHistory = [];
let isLoading = false;

const STORAGE_KEY = "loreal-selected-products";

// ==========================================
// UTILITIES
// ==========================================

// Escape text before inserting into HTML
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

// Simple safe Markdown formatter for AI messages
function formatMessage(text) {
  const escaped = escapeHTML(text);

  const lines = escaped.split("\n");
  const output = [];
  let listType = null;

  function closeList() {
    if (listType) {
      output.push(`</${listType}>`);
      listType = null;
    }
  }

  function formatInline(line) {
    return line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      closeList();

      const level = Math.min(heading[1].length + 2, 5);

      output.push(
        `<h${level}>${formatInline(heading[2])}</h${level}>`
      );

      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);

    if (ordered || unordered) {
      const type = ordered ? "ol" : "ul";
      const content = ordered ? ordered[1] : unordered[1];

      if (listType !== type) {
        closeList();
        output.push(`<${type}>`);
        listType = type;
      }

      output.push(`<li>${formatInline(content)}</li>`);
      continue;
    }

    closeList();
    output.push(`<p>${formatInline(trimmed)}</p>`);
  }

  closeList();

  return output.join("");
}

// ==========================================
// PRODUCT DATA
// ==========================================

async function loadProducts() {
  try {
    const response = await fetch("products.json");

    if (!response.ok) {
      throw new Error("Unable to load products.");
    }

    const data = await response.json();

    if (!Array.isArray(data.products)) {
      throw new Error("Invalid product data.");
    }

    allProducts = data.products;

    let saved = [];

    try {
      saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );
    } catch {
      saved = [];
    }

    selectedProducts = Array.isArray(saved)
      ? allProducts.filter(product => saved.includes(product.id))
      : [];

    displayProducts();
    updateSelectedProducts();

  } catch (error) {
    console.error("Product loading error:", error);

    productsContainer.textContent =
      "Unable to load products. Please refresh the page.";
  }
}

function saveSelectedProducts() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(selectedProducts.map(product => product.id))
    );
  } catch (error) {
    console.warn("Unable to save selected products:", error);
  }
}

// ==========================================
// SEARCH AND CATEGORY FILTERS
// ==========================================

function getFilteredProducts() {
  const search = productSearch.value.trim().toLowerCase();
  const category = categoryFilter.value;

  return allProducts.filter(product => {
    const matchesCategory =
      !category || product.category === category;

    const searchableText = [
      product.name,
      product.brand,
      product.category,
      product.description
    ].join(" ").toLowerCase();

    return matchesCategory && searchableText.includes(search);
  });
}

// ==========================================
// PRODUCT CARDS
// ==========================================

function displayProducts() {
  const products = getFilteredProducts();

  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No matching products found.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products.map(product => {
    const selected = selectedProducts.some(
      item => item.id === product.id
    );

    return `
      <article class="product-card ${selected ? "selected" : ""}">
        <button
          class="product-select"
          type="button"
          data-id="${product.id}"
          aria-pressed="${selected}"
          aria-label="${selected ? "Remove" : "Select"} ${escapeHTML(product.brand)} ${escapeHTML(product.name)}"
        >
          <span class="selection-indicator">
            ${selected ? "✓" : "+"}
          </span>

          <img
            src="${escapeHTML(product.image)}"
            alt="${escapeHTML(product.brand)} ${escapeHTML(product.name)}"
            loading="lazy"
          />

          <span class="product-info">
            <strong>${escapeHTML(product.brand)}</strong>
            <span>${escapeHTML(product.name)}</span>
          </span>
        </button>

        <details class="product-details">
          <summary>Product Details</summary>
          <p>${escapeHTML(product.description)}</p>
        </details>
      </article>
    `;
  }).join("");
}

// ==========================================
// PRODUCT SELECTION
// ==========================================

function toggleProduct(id) {
  const product = allProducts.find(item => item.id === id);

  if (!product) return;

  const exists = selectedProducts.some(
    item => item.id === id
  );

  if (exists) {
    selectedProducts = selectedProducts.filter(
      item => item.id !== id
    );
  } else {
    selectedProducts.push(product);
  }

  saveSelectedProducts();
  displayProducts();
  updateSelectedProducts();
}

function updateSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="empty-selection">
        No products selected yet. Choose products to build your routine.
      </p>
    `;
  } else {
    selectedProductsList.innerHTML = selectedProducts.map(product => `
      <div class="selected-item">
        <span>
          ${escapeHTML(product.brand)} -
          ${escapeHTML(product.name)}
        </span>

        <button
          type="button"
          class="remove-product"
          data-id="${product.id}"
          aria-label="Remove ${escapeHTML(product.name)}"
        >
          &times;
        </button>
      </div>
    `).join("");
  }

  clearSelection.hidden = selectedProducts.length === 0;
}

// ==========================================
// CHAT INTERFACE
// ==========================================

function addChatMessage(role, content) {
  const message = document.createElement("div");

  message.className = `chat-message ${role}-message`;

  const label = document.createElement("div");
  label.className = "message-label";

  label.textContent = role === "user"
    ? "You"
    : role === "assistant"
      ? "L'Oréal AI Advisor"
      : "System";

  const body = document.createElement("div");
  body.className = "message-content";

  if (role === "assistant") {
    body.innerHTML = formatMessage(content);
  } else {
    body.textContent = content;
  }

  message.appendChild(label);
  message.appendChild(body);

  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return message;
}

function showLoading() {
  const loading = document.createElement("div");

  loading.id = "chatLoading";
  loading.className = "chat-loading";
  loading.setAttribute("role", "status");

  loading.textContent = "L'Oréal AI Advisor is thinking...";

  chatWindow.appendChild(loading);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideLoading() {
  document.getElementById("chatLoading")?.remove();
}

function setLoadingState(loading) {
  isLoading = loading;

  generateRoutineBtn.disabled = loading;
  sendBtn.disabled = loading;
  userInput.disabled = loading;

  generateRoutineBtn.classList.toggle("is-loading", loading);
  sendBtn.classList.toggle("is-loading", loading);
}

// ==========================================
// OPENAI / CLOUDFLARE INTEGRATION
// ==========================================

async function sendToAI(userMessage) {
  if (isLoading) return;

  const previousHistory = [...conversationHistory];

  conversationHistory.push({
    role: "user",
    content: userMessage
  });

  const isRoutineRequest =
    userMessage.startsWith("Create a personalized beauty routine");

  const displayMessage = isRoutineRequest
    ? `Generate a personalized routine using my ${selectedProducts.length} selected product${selectedProducts.length === 1 ? "" : "s"}.`
    : userMessage;

  addChatMessage("user", displayMessage);

  setLoadingState(true);
  showLoading();

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: conversationHistory
      })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid response from the server.");
    }

    if (!response.ok) {
      throw new Error(
        data.error || `Server error (${response.status})`
      );
    }

    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("The AI returned an empty response.");
    }

    conversationHistory.push({
      role: "assistant",
      content: data.reply
    });

    hideLoading();
    addChatMessage("assistant", data.reply);

  } catch (error) {
    console.error("AI request failed:", error);

    conversationHistory = previousHistory;

    hideLoading();

    addChatMessage(
      "system",
      `Unable to generate a response: ${error.message}`
    );

  } finally {
    hideLoading();
    setLoadingState(false);
    userInput.focus();
  }
}

// ==========================================
// GENERATE PERSONALIZED ROUTINE
// ==========================================

function generateRoutine() {
  if (isLoading) return;

  if (selectedProducts.length === 0) {
    addChatMessage(
      "system",
      "Please select at least one product before generating a routine."
    );

    return;
  }

  // Include only selected products, not the entire catalog
  const productData = selectedProducts.map(product => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description
  }));

  const prompt = `
Create a personalized beauty routine using the following
selected L'Oréal brand products.

SELECTED PRODUCTS:
${JSON.stringify(productData, null, 2)}

INSTRUCTIONS:

1. Use the selected products as the foundation of the routine.
2. Identify the appropriate order of application or use.
3. Separate morning and evening steps where appropriate.
4. Explain why each product is included.
5. Include helpful usage tips and precautions.
6. If products belong to different categories, organize
   the routine into appropriate sections.
7. Do not invent product information.
8. If a necessary product category is missing, mention it
   without inventing a specific product.
9. Keep the routine practical, clear, and personalized
   to the available product information.
10. Ask one relevant follow-up question about the user's
    skin type, hair type, or beauty goals if needed.

Generate the routine now.
`.trim();

  sendToAI(prompt);
}

// ==========================================
// FOLLOW-UP CHAT
// ==========================================

function handleChatSubmit(event) {
  event.preventDefault();

  if (isLoading) return;

  const message = userInput.value.trim();

  if (!message) return;

  userInput.value = "";

  sendToAI(message);
}

// ==========================================
// NEW CHAT
// ==========================================

function resetChat() {
  if (isLoading) return;

  conversationHistory = [];
  chatWindow.innerHTML = "";

  addChatMessage(
    "assistant",
    "Welcome to your L'Oréal Smart Routine & Product Advisor! Select products to generate a personalized routine, or ask me a beauty-related question."
  );
}

// Create New Chat button
function setupNewChatButton() {
  const chatHeading = document.querySelector(".chatbox h2");

  if (!chatHeading) return;

  const button = document.createElement("button");

  button.id = "newChatBtn";
  button.type = "button";
  button.className = "new-chat-btn";
  button.innerHTML = `
    <i class="fa-solid fa-rotate-right"></i>
    New Chat
  `;

  button.addEventListener("click", resetChat);

  chatHeading.insertAdjacentElement("afterend", button);
}

// ==========================================
// EVENT LISTENERS
// ==========================================

// Product selection
productsContainer.addEventListener("click", event => {
  const button = event.target.closest(".product-select");

  if (!button) return;

  toggleProduct(Number(button.dataset.id));
});

// Remove selected product
selectedProductsList.addEventListener("click", event => {
  const button = event.target.closest(".remove-product");

  if (!button) return;

  toggleProduct(Number(button.dataset.id));
});

// Clear all products
clearSelection.addEventListener("click", () => {
  selectedProducts = [];

  saveSelectedProducts();
  displayProducts();
  updateSelectedProducts();
});

// Search and filter
productSearch.addEventListener("input", displayProducts);
categoryFilter.addEventListener("change", displayProducts);

// AI generation
generateRoutineBtn.addEventListener("click", generateRoutine);

// Follow-up chat
chatForm.addEventListener("submit", handleChatSubmit);

// ==========================================
// INITIALIZATION
// ==========================================

setupNewChatButton();
resetChat();
loadProducts();
