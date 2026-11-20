/* ==========================================
   L'ORÉAL SMART ROUTINE & PRODUCT ADVISOR
   Project 10 - Global Career Accelerator
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
// ENGLISH / ARABIC LANGUAGE SUPPORT
// ==========================================
const LANGUAGE_KEY = "loreal-advisor-language";
const translations = {
  en: {
    languageLabel: "Language", title: "Smart Routine & Product Advisor",
    searchPlaceholder: "Search products by name, brand, or keyword...",
    searchLabel: "Search products", categoryLabel: "Filter by category",
    allCategories: "All Categories", cleansers: "Cleansers",
    moisturizers: "Moisturizers & Treatments", skincare: "Skincare",
    haircare: "Haircare", makeup: "Makeup", hairColor: "Hair Color",
    hairStyling: "Hair Styling", mensGrooming: "Men's Grooming",
    suncare: "Suncare", fragrance: "Fragrance",
    selectedTitle: "Selected Products", clearAll: "Clear All Selections",
    generate: "Generate Routine", chatTitle: "Let's Build Your Routine",
    messageLabel: "Message", chatPlaceholder: "Ask me about products or routines…",
    send: "Send", footer: "Independent educational project. Not affiliated with or endorsed by L'Oréal.",
    noResults: "No matching products found.", productDetails: "Product Details",
    select: "Select", remove: "Remove", emptySelection: "No products selected yet. Choose products to build your routine.",
    you: "You", advisor: "L'Oréal AI Advisor", system: "System",
    thinking: "L'Oréal AI Advisor is thinking...", newChat: "New Chat",
    welcome: "Welcome to your L'Oréal Smart Routine & Product Advisor! Select products to generate a personalized routine, or ask me a beauty-related question.",
    noSelection: "Please select at least one product before generating a routine.",
    routineRequest: n => `Generate a personalized routine using my ${n} selected product${n === 1 ? "" : "s"}.`,
    error: message => `Unable to generate a response: ${message}`
  },
  ar: {
    languageLabel: "اللغة", title: "مستشار المنتجات وروتين العناية الذكي",
    searchPlaceholder: "ابحث عن المنتجات بالاسم أو العلامة التجارية أو كلمة مفتاحية...",
    searchLabel: "البحث عن المنتجات", categoryLabel: "تصفية حسب الفئة",
    allCategories: "جميع الفئات", cleansers: "غسول البشرة",
    moisturizers: "المرطبات والعلاجات", skincare: "العناية بالبشرة",
    haircare: "العناية بالشعر", makeup: "المكياج", hairColor: "صبغات الشعر",
    hairStyling: "تصفيف الشعر", mensGrooming: "العناية بالرجال",
    suncare: "الحماية من الشمس", fragrance: "العطور",
    selectedTitle: "المنتجات المختارة", clearAll: "إزالة جميع المنتجات المختارة",
    generate: "إنشاء روتين العناية", chatTitle: "لنصمم روتين العناية الخاص بك",
    messageLabel: "الرسالة", chatPlaceholder: "اسألني عن المنتجات أو روتين العناية...",
    send: "إرسال", footer: "مشروع تعليمي مستقل، غير تابع لشركة لوريال أو معتمد منها.",
    noResults: "لم يتم العثور على منتجات مطابقة.", productDetails: "تفاصيل المنتج",
    select: "اختيار", remove: "إزالة", emptySelection: "لم تختر أي منتجات بعد. اختر منتجات لإنشاء روتينك.",
    you: "أنت", advisor: "مستشار لوريال الذكي", system: "النظام",
    thinking: "مستشار لوريال الذكي يفكر...", newChat: "محادثة جديدة",
    welcome: "مرحبًا بك في مستشار المنتجات وروتين العناية الذكي! اختر منتجات لإنشاء روتين مخصص، أو اطرح سؤالًا عن الجمال والعناية.",
    noSelection: "يرجى اختيار منتج واحد على الأقل قبل إنشاء الروتين.",
    routineRequest: n => `أنشئ روتين عناية مخصصًا باستخدام ${n} من المنتجات المختارة.`,
    error: message => `تعذر إنشاء الرد: ${message}`
  }
};
let currentLanguage = "en";
function t(key) { return translations[currentLanguage][key]; }
function applyLanguage(language) {
  currentLanguage = language === "ar" ? "ar" : "en";
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";
  document.getElementById("languageSelect").value = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.getElementById("newChatBtn").querySelector("span").textContent = t("newChat");
  // Preserve selected products and chat history when switching languages.
  displayProducts();
  updateSelectedProducts();
  // Existing messages retain their original language; new messages use the chosen language.
  try { localStorage.setItem(LANGUAGE_KEY, currentLanguage); } catch {}
}


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


/* ==========================================
   AI MESSAGE MARKDOWN FORMATTING
   ========================================== */

function formatMessage(text) {
  const escaped = escapeHTML(text);
  const lines = escaped.split("\n");

  const output = [];
  let listType = null;
  let listItemOpen = false;
  let listCounter = 0;

  function formatInline(value) {
    return value
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  function closeListItem() {
    if (listItemOpen) {
      output.push("</li>");
      listItemOpen = false;
    }
  }

  function closeList() {
    closeListItem();

    if (listType) {
      output.push(`</${listType}>`);
      listType = null;
      listCounter = 0;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank lines
    if (!trimmed) {
      continue;
    }

    // Markdown headings
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      closeList();

      const level = Math.min(heading[1].length + 1, 6);

      output.push(
        `<h${level}>${formatInline(heading[2])}</h${level}>`
      );

      continue;
    }

    // Numbered lists: 1. Item or 1) Item
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (ordered) {
      if (listType !== "ol") {
        closeList();
        output.push("<ol>");
        listType = "ol";
        listCounter = 0;
      }

      closeListItem();

      listCounter++;

      output.push(
        `<li value="${listCounter}">${formatInline(ordered[1])}`
      );

      listItemOpen = true;
      continue;
    }

    // Bullet lists
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);

    if (unordered) {
      if (listType === "ol" && listItemOpen) {
        // Attach bullet points to the current numbered step
        output.push(
          `<ul><li>${formatInline(unordered[1])}</li></ul>`
        );
      } else {
        if (listType !== "ul") {
          closeList();
          output.push("<ul>");
          listType = "ul";
        }

        closeListItem();

        output.push(
          `<li>${formatInline(unordered[1])}`
        );

        listItemOpen = true;
      }

      continue;
    }

    // Normal paragraphs
    closeList();

    output.push(
      `<p>${formatInline(trimmed)}</p>`
    );
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
        ${t("noResults")}
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
          aria-label="${selected ? t("remove") : t("select")} ${escapeHTML(product.brand)} ${escapeHTML(product.name)}"
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
          <summary>${t("productDetails")}</summary>
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
        ${t("emptySelection")}
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
          aria-label="${t("remove")} ${escapeHTML(product.name)}"
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
    ? t("you")
    : role === "assistant"
      ? t("advisor")
      : t("system");

  const body = document.createElement("div");
  body.className = "message-content";

  if (role === "assistant") {
    const arabicCharacters = (content.match(/[\u0600-\u06FF]/g) || []).length;
    const latinCharacters = (content.match(/[A-Za-z]/g) || []).length;
    body.dir = arabicCharacters > latinCharacters ? "rtl" : "ltr";
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

  loading.textContent = t("thinking");

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

  // The language instruction travels with the user request; the Worker needs no changes.
  const languageInstruction = currentLanguage === "ar"
    ? "\n\n[Language preference: Respond entirely in natural Arabic. Keep product and brand names accurate. Use Arabic headings and RTL-friendly lists.]"
    : "\n\n[Language preference: Respond in English.]";
  conversationHistory.push({
    role: "user",
    content: userMessage + languageInstruction
  });

  const isRoutineRequest =
    userMessage.startsWith("Create a personalized beauty routine");

  const displayMessage = isRoutineRequest
    ? t("routineRequest")(selectedProducts.length)
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
      t("error")(error.message)
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
      t("noSelection")
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
    t("welcome")
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
    <span>${t("newChat")}</span>
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
let savedLanguage = "en";
try { savedLanguage = localStorage.getItem(LANGUAGE_KEY) || "en"; } catch {}
applyLanguage(savedLanguage);
resetChat();
loadProducts();
document.getElementById("languageSelect").addEventListener("change", event => {
  applyLanguage(event.target.value);
});
