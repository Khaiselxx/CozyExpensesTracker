// Initial State Data (Loaded from localStorage or defaults)
let transactions = JSON.parse(localStorage.getItem('web_transactions')) || [
    { id: 1, date: new Date().toISOString().split('T')[0], category: 'Fuel/Transport', description: 'gas for innova', amount: 500 },
    { id: 2, date: new Date().toISOString().split('T')[0], category: 'Utilities (Internet)', description: 'dito internet', amount: 1200 }
];

let goals = JSON.parse(localStorage.getItem('web_goals')) || [
    { id: 1, name: 'Hardware Upgrades (AM5)', target: 25000, current: 5000, deadline: 'Dec 2026' }
];

let spendingChart = null; // Global chart reference

function saveData() {
    localStorage.setItem('web_transactions', JSON.stringify(transactions));
    localStorage.setItem('web_goals', JSON.stringify(goals));
    renderTable();
    updateTrends();
    renderGoals();
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

    // 1. Food & Dining (Expanded with meat, steak, groceries, etc.)
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

    // 4. Development & Tools (Coding, Software, Hosting, Hardware)
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

document.getElementById('quickInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleQuickAdd();
});

// Render Table, Metrics & Pie Chart
function renderTable() {
    let tbody = document.getElementById('transactionTableBody');
    let searchQuery = document.getElementById('searchBox').value.toLowerCase();
    let selectedCategory = document.getElementById('categoryFilter').value;
    
    tbody.innerHTML = '';
    let total = 0;
    let breakdown = {};

    let filtered = transactions.filter(t => {
        let matchesCat = selectedCategory === 'All Categories' || t.category === selectedCategory;
        let matchesSearch = t.description.toLowerCase().includes(searchQuery) || t.category.toLowerCase().includes(searchQuery);
        return matchesCat && matchesSearch;
    });

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

    document.getElementById('totalSummary').innerText = `🌸 Filtered Total: ₱${total.toLocaleString('en-US', {minimumFractionDigits: 2})} (${filtered.length} items shown)`;

    // Update Chart.js Pie Chart
    updateSpendingChart(breakdown);
}

function updateSpendingChart(breakdownData) {
    let ctx = document.getElementById('spendingPieChart').getContext('2d');
    
    let labels = Object.keys(breakdownData);
    let data = Object.values(breakdownData);

    // Distinct pastel colors for each slice
    let colorPalette = [
        '#a29bfe', // Periwinkle lavender
        '#fd79a8', // Soft pink
        '#55efc4', // Mint green
        '#ffeaa7', // Butter yellow
        '#74b9ff', // Sky blue
        '#fab1a0', // Peach
        '#e84393', // Magenta pink
        '#00b894'  // Teal green
    ];

    // Map each category to its own unique color
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

function deleteTx(id) {
    if (confirm("🐱 Are you sure you want to delete this transaction?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
    }
}

// Trends calculation
function updateTrends() {
    let now = new Date();
    let curMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
    let prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let prevMonthStr = prevDate.toISOString().slice(0, 7);

    let curTotal = transactions.filter(t => t.date.startsWith(curMonthStr)).reduce((sum, t) => sum + t.amount, 0);
    let prevTotal = transactions.filter(t => t.date.startsWith(prevMonthStr)).reduce((sum, t) => sum + t.amount, 0);

    document.getElementById('currentMonthBox').innerHTML = `<h4>🌸 This Month (${curMonthStr})</h4><p style="font-size: 18px; font-weight: bold; margin-top: 5px;">₱${curTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>`;
    document.getElementById('prevMonthBox').innerHTML = `<h4>🐱 Last Month (${prevMonthStr})</h4><p style="font-size: 18px; font-weight: bold; margin-top: 5px;">₱${prevTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}</p>`;

    let summaryEl = document.getElementById('trendSummaryText');
    if (prevTotal > 0) {
        let diff = ((curTotal - prevTotal) / prevTotal) * 100;
        summaryEl.innerText = diff >= 0 ? `🐱 Spending is HIGHER by +${diff.toFixed(1)}% compared to last month.` : `🌸 Spending is LOWER by ${diff.toFixed(1)}% compared to last month. Great job!`;
    } else {
        summaryEl.innerText = "🐱 No comparative spending data recorded for last month yet.";
    }
}

// Savings Goals Functions
function renderGoals() {
    let container = document.getElementById('goalsContainer');
    container.innerHTML = '';

    if (goals.length === 0) {
        container.innerHTML = '<p>🐱 No savings goals created yet. Let blooms grow by adding one!</p>';
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

function deleteGoal(id) {
    if (confirm("🐱 Are you sure you want to delete this goal?")) {
        goals = goals.filter(g => g.id !== id);
        saveData();
    }
}

// Initial Load
renderTable();
updateTrends();
renderGoals();