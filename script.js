import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// Expose all UI functions globally for inline HTML onclick handlers
window.switchTab = switchTab;
window.handleQuickAdd = handleQuickAdd;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEditedTransaction = saveEditedTransaction;
window.deleteTx = deleteTx;
window.openNewGoalModal = openNewGoalModal;
window.closeNewGoalModal = closeNewGoalModal;
window.saveNewGoal = saveNewGoal;
window.depositGoal = depositGoal;
window.deleteGoal = deleteGoal;
window.openBudgetModal = openBudgetModal;
window.closeBudgetModal = closeBudgetModal;
window.saveBudgets = saveBudgets;
window.openLogoutModal = openLogoutModal;
window.closeLogoutModal = closeLogoutModal;
window.confirmLogout = confirmLogout;
window.closeCozyAlert = closeCozyAlert;
window.closeDeleteModal = closeDeleteModal;

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCfHM-HSU-emecmX3L4nGXZgG1Z0mQSpwA",
    authDomain: "cozy-expense-tracker-cfe23.firebaseapp.com",
    projectId: "cozy-expense-tracker-cfe23",
    storageBucket: "cozy-expense-tracker-cfe23.firebasestorage.app",
    messagingSenderId: "1004346376450",
    appId: "1:1004346376450:web:0ce118a44539bae428421b",
    measurementId: "G-H0J546DWPW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let transactions = []; // Starts completely empty
let goals = [];        // Starts completely empty

// All 7 core application categories initialized with default guardrail limits
let budgets = {
    'Food & Dining': 5000,
    'Fuel/Transport': 4000,
    'Utilities (Internet)': 2000,
    'Development/Tools': 3000,
    'Fitness/Supplements': 2500,
    'Subscriptions': 1500,
    'Other': 1000
};

let spendingChart = null; // Global chart reference
let transactionToDeleteId = null; // Tracks transaction pending deletion

// Protect index.html: Kick to login if not authenticated or email unverified
onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "login.html";
    } else {
        // Refresh user details to check latest email verification status from Firebase servers
        await user.reload();

        if (!user.emailVerified) {
            alert("🐾 Meow! Please check your inbox and verify your email address before accessing your command center.");
            signOut(auth).then(() => {
                window.location.href = "login.html";
            });
            return;
        }

        currentUser = user;
        let emailEl = document.getElementById('userDisplayEmail');
        if (emailEl) emailEl.innerText = `👤 ${user.email} (Verified 🌸)`;
        loadUserDataFromFirebase();
    }
});

// Logout Modal Handlers
function openLogoutModal() {
    let modal = document.getElementById('logoutModal');
    if (modal) modal.style.display = 'flex';
}

function closeLogoutModal() {
    let modal = document.getElementById('logoutModal');
    if (modal) modal.style.display = 'none';
}

function confirmLogout() {
    signOut(auth).then(() => {
        window.location.href = "login.html";
    }).catch(error => {
        console.error("Logout error:", error);
    });
}

// Load data strictly from this user's cloud document in Firebase
async function loadUserDataFromFirebase() {
    if (!currentUser) return;
    try {
        let docRef = doc(db, 'users', currentUser.uid);
        let docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            let data = docSnap.data();
            transactions = data.transactions || [];
            goals = data.goals || [];
            budgets = { ...budgets, ...(data.budgets || {}) };
        } else {
            // Brand new account starts completely clean with no default dummy data
            transactions = [];
            goals = [];
            budgets = {
                'Food & Dining': 5000,
                'Fuel/Transport': 4000,
                'Utilities (Internet)': 2000,
                'Development/Tools': 3000,
                'Fitness/Supplements': 2500,
                'Subscriptions': 1500,
                'Other': 1000
            };
            saveData();
        }
        renderTable();
        updateTrends();
        renderGoals();
        renderBudgetGuards();
    } catch (e) {
        console.error("Error loading user data:", e);
    }
}

// Save data strictly to this user's cloud document in Firebase
async function saveData() {
    if (!currentUser) return;
    try {
        let docRef = doc(db, 'users', currentUser.uid);
        await setDoc(docRef, {
            transactions: transactions,
            goals: goals,
            budgets: budgets
        }, { merge: true });
    } catch (e) {
        console.error("Error saving data:", e);
    }
    renderTable();
    updateTrends();
    renderGoals();
    renderBudgetGuards();
}

// Tab Switching
function switchTab(evt, tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
    
    // Refresh chart layout if switching back to dashboard tab
    if (tabId === 'dashboardTab' && spendingChart) {
        spendingChart.update();
    }
}

// 🧠 SMART NATURAL LANGUAGE PARSER
function handleQuickAdd() {
    let rawInput = document.getElementById('quickInput').value.trim();
    if (!rawInput) return;

    // Regex to capture amount (supports commas and decimals) at the start or anywhere in text
    let match = rawInput.match(/^([\d,.]+)\s+(.*)$/) || rawInput.match(/^(.*?)\s+([\d,.]+)$/);
    
    let amount = 0;
    let desc = "";

    if (match) {
        if (!isNaN(parseFloat(match[1].replace(/,/g, '')))) {
            amount = parseFloat(match[1].replace(/,/g, ''));
            desc = match[2].trim();
        } else {
            amount = parseFloat(match[2].replace(/,/g, ''));
            desc = match[1].trim();
        }
    } else {
        alert("🐾 Meow! Could not detect a valid amount. Try format: '1781 bought steak'");
        return;
    }

    // Smart Category Inference Engine
    let category = inferCategory(desc);

    // 🛡️ Check budget before adding to trigger centered cozy alert modal
    checkBudgetBeforeAdd(category, amount);

    let newTx = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        category: category,
        description: desc.toLowerCase(),
        amount: amount
    };

    transactions.unshift(newTx);
    document.getElementById('quickInput').value = '';
    saveData();
}

// Intelligent keyword analysis for smart categorization
function inferCategory(text) {
    let lower = text.toLowerCase();

    // 1. Food & Dining
    if (lower.match(/(steak|meat|beef|pork|chicken|coffee|latte|espresso|food|lunch|dinner|breakfast|burger|pizza|jollibee|mcdo|starbucks|restaurant|cafe|snack|grocery|groceries|supermarket|water|drinks|boba)/)) {
        return 'Food & Dining';
    }
    
    // 2. Fuel & Transport
    if (lower.match(/(gas|gasoline|diesel|petrol|transport|parking|toll|innova|grab|taxi|angkas|moveit|bus|train|maintenance|car)/)) {
        return 'Fuel/Transport';
    }

    // 3. Utilities (Internet, Electricity, Water, Phone)
    if (lower.match(/(internet|wifi|dito|pldt|globe|smart|electricity|meralco|water|bill|bills|phone|load)/)) {
        return 'Utilities (Internet)';
    }

    // 4. Development & Tools
    if (lower.match(/(domain|hosting|server|cloudflare|github|vscode|intellij|plugin|api|software|tool|code|dev|hardware|pc|upgrade)/)) {
        return 'Development/Tools';
    }

    // 5. Fitness & Supplements
    if (lower.match(/(gym|supplements|creatine|whey|protein|workout|fitness|barbell|weights|membership)/)) {
        return 'Fitness/Supplements';
    }

    // 6. Subscriptions
    if (lower.match(/(netflix|spotify|youtube|subscription|sub|prime|chatgpt|gemini|openai)/)) {
        return 'Subscriptions';
    }

    // Default fallback category if no match is found
    return 'Other';
}

let quickInputEl = document.getElementById('quickInput');
if (quickInputEl) {
    quickInputEl.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleQuickAdd();
    });
}

// Render Table with Cozy Empty State
function renderTable() {
    let tbody = document.getElementById('transactionTableBody');
    if (!tbody) return;

    let searchBox = document.getElementById('searchBox');
    let categoryFilter = document.getElementById('categoryFilter');
    let searchQuery = searchBox ? searchBox.value.toLowerCase() : '';
    let selectedCategory = categoryFilter ? categoryFilter.value : 'All Categories';
    
    tbody.innerHTML = '';
    let total = 0;
    let breakdown = {};

    let filtered = transactions.filter(t => {
        let matchesCat = selectedCategory === 'All Categories' || t.category === selectedCategory;
        let matchesSearch = t.description.toLowerCase().includes(searchQuery) || t.category.toLowerCase().includes(searchQuery);
        return matchesCat && matchesSearch;
    });

    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 8px;">🐱💤</div>
                    <h4 style="color: var(--primary); margin-bottom: 4px;">No transactions recorded yet!</h4>
                    <p style="color: #8c829e; font-size: 13px;">Use the Quick Command bar above (e.g., <em>500 gas for innova</em>) to add your first transaction, meow!</p>
                </td>
            </tr>
        `;
    } else if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 30px; color: #8c829e;">
                    🐾 No matching transactions found for your search.
                </td>
            </tr>
        `;
    } else {
        filtered.forEach(t => {
            total += t.amount;
            breakdown[t.category] = (breakdown[t.category] || 0) + t.amount;

            let row = document.createElement('tr');
            row.innerHTML = `
                <td>${t.date}</td>
                <td>🌸 ${t.category}</td>
                <td>${t.description}</td>
                <td>₱${t.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn btn-primary" style="padding: 3px 8px; font-size: 11px;" onclick="openEditModal(${t.id})">Edit</button>
                        <button class="btn btn-danger" style="padding: 3px 8px; font-size: 11px;" onclick="deleteTx(${t.id})">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    let totalSummaryEl = document.getElementById('totalSummary');
    if (totalSummaryEl) {
        totalSummaryEl.innerText = `🌸 Filtered Total: ₱${total.toLocaleString('en-US', {minimumFractionDigits: 2})} (${filtered.length} items shown)`;
    }

    // Update Chart.js Pie Chart
    updateSpendingChart(breakdown);
}

function updateSpendingChart(breakdownData) {
    let canvas = document.getElementById('spendingPieChart');
    if (!canvas) return;
    let ctx = canvas.getContext('2d');
    
    let labels = Object.keys(breakdownData);
    let data = Object.values(breakdownData);

    // Distinct pastel colors for each slice
    let colorPalette = [
        '#a29bfe', '#fd79a8', '#55efc4', '#ffeaa7', '#74b9ff', '#fab1a0', '#e84393', '#00b894'
    ];

    let backgroundColors = labels.map((_, index) => colorPalette[index % colorPalette.length]);

    if (spendingChart) {
        spendingChart.data.labels = labels;
        spendingChart.data.datasets[0].data = data;
        spendingChart.data.datasets[0].backgroundColor = backgroundColors;
        spendingChart.update();
    } else {
        spendingChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 12 } }
                    }
                }
            }
        });
    }
}

// Edit Transaction Functions
function openEditModal(id) {
    let tx = transactions.find(t => t.id === id);
    if (!tx) return;

    document.getElementById('editTxId').value = tx.id;
    document.getElementById('editTxDate').value = tx.date;
    document.getElementById('editTxCategory').value = tx.category;
    document.getElementById('editTxDesc').value = tx.description;
    document.getElementById('editTxAmount').value = tx.amount;

    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function saveEditedTransaction() {
    let id = parseInt(document.getElementById('editTxId').value);
    let date = document.getElementById('editTxDate').value;
    let category = document.getElementById('editTxCategory').value;
    let description = document.getElementById('editTxDesc').value.trim();
    let amount = parseFloat(document.getElementById('editTxAmount').value);

    if (description && amount > 0 && date) {
        let tx = transactions.find(t => t.id === id);
        if (tx) {
            tx.date = date;
            tx.category = category;
            tx.description = description.toLowerCase();
            tx.amount = amount;
            closeEditModal();
            saveData();
        }
    } else {
        alert("🐾 Please provide a valid date, description, and amount!");
    }
}

// Custom Delete Confirmation Modal Logic
function deleteTx(id) {
    transactionToDeleteId = id;
    let modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.style.display = 'flex';
}

function closeDeleteModal() {
    transactionToDeleteId = null;
    let modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.style.display = 'none';
}

let confirmDelBtn = document.getElementById('confirmDeleteBtn');
if (confirmDelBtn) {
    confirmDelBtn.addEventListener('click', function() {
        if (transactionToDeleteId !== null) {
            transactions = transactions.filter(t => t.id !== transactionToDeleteId);
            closeDeleteModal();
            saveData();
        }
    });
}

// Trends calculation
function updateTrends() {
    let now = new Date();
    let curMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
    let prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let prevMonthStr = prevDate.toISOString().slice(0, 7);

    let curTotal = transactions.filter(t => t.date.startsWith(curMonthStr)).reduce((sum, t) => sum + t.amount, 0);
    let prevTotal = transactions.filter(t => t.date.startsWith(prevMonthStr)).reduce((sum, t) => sum + t.amount, 0);

    let curBox = document.getElementById('currentMonthBox');
    let prevBox = document.getElementById('prevMonthBox');

    if (curBox) curBox.innerHTML = `<h4>🌸 This Month (${curMonthStr})</h4><p style="font-size: 18px; font-weight: bold; margin-top: 5px;">₱${curTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>`;
    if (prevBox) prevBox.innerHTML = `<h4>🐱 Last Month (${prevMonthStr})</h4><p style="font-size: 18px; font-weight: bold; margin-top: 5px;">₱${prevTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>`;

    let summaryEl = document.getElementById('trendSummaryText');
    if (summaryEl) {
        if (prevTotal > 0) {
            let diff = ((curTotal - prevTotal) / prevTotal) * 100;
            summaryEl.innerText = diff >= 0 ? `🐱 Spending is HIGHER by +${diff.toFixed(1)}% compared to last month.` : `🌸 Spending is LOWER by ${diff.toFixed(1)}% compared to last month. Great job!`;
        } else {
            summaryEl.innerText = "🐱 No comparative spending data recorded for last month yet.";
        }
    }
}

// Savings Goals with Cozy Empty State
function renderGoals() {
    let container = document.getElementById('goalsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (goals.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 8px;">🌷🐾</div>
                <h4 style="color: var(--primary); margin-bottom: 4px;">No savings goals created yet!</h4>
                <p style="color: #8c829e; font-size: 13px; margin-bottom: 15px;">Let your savings bloom by creating your first goal, meow!</p>
                <button class="btn btn-success" onclick="openNewGoalModal()" style="width: auto; padding: 8px 20px;">+ Create New Goal</button>
            </div>
        `;
        return;
    }

    goals.forEach(g => {
        let percent = Math.min((g.current / g.target) * 100, 100);
        let card = document.createElement('div');
        card.className = 'goal-card';
        card.innerHTML = `
            <h4>🐱 ${g.name}</h4>
            <p style="font-size: 13px; color: #8c829e; margin-top: 2px;">Target: ₱${g.target.toLocaleString()}</p>
            <div class="progress-bar"><div class="progress-fill" style="width: ${percent}%;"></div></div>
            <div class="goal-meta">
                <span>Saved: ₱${g.current.toLocaleString()} (${percent.toFixed(0)}%)</span>
                <span>Deadline: 🐱 ${g.deadline}</span>
            </div>
            <div class="goal-actions">
                <button class="btn btn-success" style="flex: 1; padding: 5px;" onclick="depositGoal(${g.id})">🌸 + Deposit</button>
                <button class="btn btn-danger" style="padding: 5px;" onclick="deleteGoal(${g.id})">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function openNewGoalModal() { document.getElementById('goalModal').style.display = 'flex'; }
function closeNewGoalModal() { document.getElementById('goalModal').style.display = 'none'; }

function saveNewGoal() {
    let name = document.getElementById('modalGoalName').value.trim();
    let target = parseFloat(document.getElementById('modalGoalTarget').value);
    let deadline = document.getElementById('modalGoalDeadline').value.trim();

    if (name && target > 0) {
        goals.push({ id: Date.now(), name, target, current: 0, deadline: deadline || 'No Deadline' });
        closeNewGoalModal();
        document.getElementById('modalGoalName').value = '';
        document.getElementById('modalGoalTarget').value = '';
        document.getElementById('modalGoalDeadline').value = '';
        saveData();
    }
}

function depositGoal(id) {
    let amountStr = prompt("🐾 Enter amount to deposit (₱):", "500");
    if (amountStr) {
        let amt = parseFloat(amountStr);
        if (amt > 0) {
            let goal = goals.find(g => g.id === id);
            if (goal) {
                goal.current += amt;
                saveData();
            }
        }
    }
}

let goalToDeleteId = null; // Tracks savings goal pending deletion

// Replace the old deleteGoal function with this:
function deleteGoal(id) {
    goalToDeleteId = id;
    let modal = document.getElementById('deleteGoalModal');
    if (modal) modal.style.display = 'flex';
}

function closeDeleteGoalModal() {
    goalToDeleteId = null;
    let modal = document.getElementById('deleteGoalModal');
    if (modal) modal.style.display = 'none';
}

// Attach event listener for the confirmation button
let confirmGoalDelBtn = document.getElementById('confirmDeleteGoalBtn');
if (confirmGoalDelBtn) {
    confirmGoalDelBtn.addEventListener('click', function() {
        if (goalToDeleteId !== null) {
            goals = goals.filter(g => g.id !== goalToDeleteId);
            closeDeleteGoalModal();
            saveData();
        }
    });
}

// Make sure to expose the close function globally if needed
window.closeDeleteGoalModal = closeDeleteGoalModal;

// 🛡️ Smart Budget Guardrails Engine
function renderBudgetGuards() {
    let container = document.getElementById('budgetGuardContainer');
    if (!container) return;
    container.innerHTML = '';

    let now = new Date();
    let curMonthStr = now.toISOString().slice(0, 7); // YYYY-MM

    let monthlySpend = {};
    transactions.forEach(t => {
        if (t.date.startsWith(curMonthStr)) {
            monthlySpend[t.category] = (monthlySpend[t.category] || 0) + t.amount;
        }
    });

    let hasBudgets = Object.keys(budgets).length > 0;
    if (!hasBudgets) {
        container.innerHTML = '<p style="font-size: 13px; color: #8c829e;">No budget limits configured yet. Click "Set Limits" to protect your wallet!</p>';
        return;
    }

    for (let [cat, limit] of Object.entries(budgets)) {
        let spent = monthlySpend[cat] || 0;
        let percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
        let statusColor = '#55efc4';
        let statusEmoji = '🌸';
        let alertText = 'On track';

        if (percent >= 100) {
            statusColor = '#ff7675';
            statusEmoji = '🚨';
            alertText = 'Budget exceeded!';
        } else if (percent >= 80) {
            statusColor = '#ffeaa7';
            statusEmoji = '🐾';
            alertText = 'Meow! Approaching limit!';
        }

        let item = document.createElement('div');
        item.style.marginBottom = '12px';
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 4px;">
                <span>${statusEmoji} ${cat}</span>
                <span style="color: #8c829e;">₱${spent.toLocaleString()} / ₱${limit.toLocaleString()}</span>
            </div>
            <div class="progress-bar" style="height: 10px; margin: 4px 0;">
                <div style="height: 100%; width: ${percent}%; background: ${statusColor}; border-radius: 5px; transition: width 0.3s ease;"></div>
            </div>
            <div style="font-size: 11px; color: #8c829e; display: flex; justify-content: space-between;">
                <span>${percent.toFixed(0)}% used</span>
                <span style="font-weight: 600; color: ${percent >= 100 ? 'var(--danger)' : 'var(--text-color);'}">${alertText}</span>
            </div>
        `;
        container.appendChild(item);
    }
}

function openBudgetModal() {
    let foodEl = document.getElementById('budgetFood');
    let fuelEl = document.getElementById('budgetFuel');
    let utilEl = document.getElementById('budgetUtilities');
    let devEl = document.getElementById('budgetDev');
    let fitEl = document.getElementById('budgetFitness');
    let subEl = document.getElementById('budgetSubs');
    let othEl = document.getElementById('budgetOther');

    if (foodEl) foodEl.value = budgets['Food & Dining'] || 5000;
    if (fuelEl) fuelEl.value = budgets['Fuel/Transport'] || 4000;
    if (utilEl) utilEl.value = budgets['Utilities (Internet)'] || 2000;
    if (devEl) devEl.value = budgets['Development/Tools'] || 3000;
    if (fitEl) fitEl.value = budgets['Fitness/Supplements'] || 2500;
    if (subEl) subEl.value = budgets['Subscriptions'] || 1500;
    if (othEl) othEl.value = budgets['Other'] || 1000;

    let modal = document.getElementById('budgetModal');
    if (modal) modal.style.display = 'flex';
}

function closeBudgetModal() {
    let modal = document.getElementById('budgetModal');
    if (modal) modal.style.display = 'none';
}

function saveBudgets() {
    let foodEl = document.getElementById('budgetFood');
    let fuelEl = document.getElementById('budgetFuel');
    let utilEl = document.getElementById('budgetUtilities');
    let devEl = document.getElementById('budgetDev');
    let fitEl = document.getElementById('budgetFitness');
    let subEl = document.getElementById('budgetSubs');
    let othEl = document.getElementById('budgetOther');

    budgets['Food & Dining'] = foodEl ? parseFloat(foodEl.value) || 0 : budgets['Food & Dining'];
    budgets['Fuel/Transport'] = fuelEl ? parseFloat(fuelEl.value) || 0 : budgets['Fuel/Transport'];
    budgets['Utilities (Internet)'] = utilEl ? parseFloat(utilEl.value) || 0 : budgets['Utilities (Internet)'];
    budgets['Development/Tools'] = devEl ? parseFloat(devEl.value) || 0 : budgets['Development/Tools'];
    budgets['Fitness/Supplements'] = fitEl ? parseFloat(fitEl.value) || 0 : budgets['Fitness/Supplements'];
    budgets['Subscriptions'] = subEl ? parseFloat(subEl.value) || 0 : budgets['Subscriptions'];
    budgets['Other'] = othEl ? parseFloat(othEl.value) || 0 : budgets['Other'];

    closeBudgetModal();
    saveData();
}

// 🛡️ Budget Alert Modal Helpers
function checkBudgetBeforeAdd(category, addAmount) {
    let limit = budgets[category];
    if (limit === undefined) return;

    let now = new Date();
    let curMonthStr = now.toISOString().slice(0, 7);
    
    let currentSpent = transactions
        .filter(t => t.date.startsWith(curMonthStr) && t.category === category)
        .reduce((sum, t) => sum + t.amount, 0);

    let newTotal = currentSpent + addAmount;
    let percent = limit > 0 ? (newTotal / limit) * 100 : 0;

    if (newTotal >= limit && currentSpent < limit) {
        showCozyAlert(
            "🚨 BUDGET EXCEEDED!", 
            `Meow! This expense pushed your '${category}' spending past your ₱${limit.toLocaleString()} limit! (Total: ₱${newTotal.toLocaleString()})`, 
            "🚨"
        );
    } else if (percent >= 80 && (currentSpent / limit) * 100 < 80) {
        showCozyAlert(
            "🐾 Approaching Limit!", 
            `Heads up! This transaction brings your '${category}' spending to ${percent.toFixed(0)}% of your ₱${limit.toLocaleString()} limit.`, 
            "🐾"
        );
    }
}

function showCozyAlert(title, message, emojiType) {
    let titleEl = document.getElementById('cozyAlertTitle');
    let msgEl = document.getElementById('cozyAlertMessage');
    let badgeEl = document.getElementById('cozyAlertBadge');
    let modalEl = document.getElementById('cozyAlertModal');

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    
    if (badgeEl) {
        badgeEl.style.backgroundColor = (emojiType === "🚨") ? "var(--danger)" : "#f39c12";
    }

    if (modalEl) modalEl.style.display = 'flex';
}

function closeCozyAlert() {
    let modalEl = document.getElementById('cozyAlertModal');
    if (modalEl) modalEl.style.display = 'none';
}