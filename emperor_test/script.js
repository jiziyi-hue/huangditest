// ===== Supabase Connection =====
// Rule: Initialize Supabase client with the correct Project URL and Anon Key.
const SUPABASE_URL = 'https://eohsgfagwsbkeqlosmzo.supabase.co';
// Rule: Replace the old JWT token with your provided public API key.
const SUPABASE_ANON_KEY = 'sb_publishable__Y-Hktg837uP36ev005qJg_1r75ulNX';
let supabaseClient = null;

try {
    const { createClient } = supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.warn('Supabase init failed, fallback to local storage:', e);
}

// ===== 游戏状态管理 =====
const gameState = {
    mode: null, // 'simple' 或 'full'
    currentQuestion: 0,
    answers: {}, // { questionId: value }
    filteredQuestions: [],
    targetEmperorIndex: null,
    gameStartTime: null  // 用于计算游戏时长
};

// ===== 图鉴收集管理 =====
const COLLECTION_KEY = 'emperor_collection';

// 徽章定义
const COLLECTION_BADGES = [
    { id: 'first_blood', name: '初窥门径', desc: '解锁第{count}位皇帝', icon: '🎯', condition: (count) => count >= 1 },
    { id: 'explorer', name: '探索者', desc: '解锁{count}位皇帝', icon: '🔍', condition: (count) => count >= 5 },
    { id: 'collector', name: '收藏家', desc: '解锁{count}位皇帝', icon: '📚', condition: (count) => count >= 10 },
    { id: 'historian', name: '史学家', desc: '解锁{count}位皇帝', icon: '📜', condition: (count) => count >= 20 },
    { id: 'master', name: '帝王师', desc: '解锁{count}位皇帝', icon: '👑', condition: (count) => count >= 30 },
    { id: 'legend', name: '千古一帝', desc: '解锁全部皇帝', icon: '🏆', condition: (count, total) => count >= total }
];

function getCollection() {
    const saved = localStorage.getItem(COLLECTION_KEY);
    return saved ? JSON.parse(saved) : {};
}

function saveCollection(collection) {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
}

function unlockEmperor(emperorIndex) {
    const collection = getCollection();
    if (!collection[emperorIndex]) {
        collection[emperorIndex] = {
            unlockedAt: new Date().toISOString(),
            count: 1
        };
        saveCollection(collection);
        updateCollectionProgress();
        updateBadges(); // 更新徽章
        return true; // 新解锁
    } else {
        collection[emperorIndex].count++;
        saveCollection(collection);
        return false; // 已解锁过
    }
}

function updateCollectionProgress() {
    const collection = getCollection();
    const unlockedCount = Object.keys(collection).length;
    const totalCount = emperors.length;
    const progressText = `${unlockedCount}/${totalCount}`;
    const progressPercent = (unlockedCount / totalCount) * 100;

    // 更新侧边栏进度
    const sidebarProgressText = document.getElementById('sidebar-progress-text');
    const sidebarProgressFill = document.getElementById('sidebar-progress-fill');
    const sidebarBadge = document.getElementById('sidebar-badge');

    if (sidebarProgressText) {
        sidebarProgressText.textContent = progressText;
    }
    if (sidebarProgressFill) {
        sidebarProgressFill.style.width = `${progressPercent}%`;
    }
    if (sidebarBadge) {
        sidebarBadge.textContent = unlockedCount > 0 ? unlockedCount.toString() : '';
        sidebarBadge.classList.toggle('show', unlockedCount > 0);
    }

    return { unlockedCount, totalCount };
}

// ===== 徽章系统 =====
function updateBadges() {
    const collection = getCollection();
    const unlockedCount = Object.keys(collection).length;
    const totalCount = emperors.length;
    const badgesContainer = document.getElementById('badges-display');

    if (!badgesContainer) return;

    // 获取已获得的徽章，只取最高级的一个
    const earnedBadges = COLLECTION_BADGES.filter(badge => badge.condition(unlockedCount, totalCount));
    const topBadge = earnedBadges.length > 0 ? earnedBadges[earnedBadges.length - 1] : null;

    // 清空并重新渲染徽章
    badgesContainer.innerHTML = '';

    if (topBadge) {
        // 动态替换描述中的{count}为当前解锁数量
        const dynamicDesc = topBadge.desc.replace('{count}', unlockedCount);

        const badgeEl = document.createElement('div');
        badgeEl.className = 'badge-item';
        badgeEl.innerHTML = `
            <span class="badge-icon">${topBadge.icon}</span>
            <div class="badge-info">
                <span class="badge-name">${topBadge.name}</span>
                <span class="badge-desc">${dynamicDesc}</span>
            </div>
        `;
        badgesContainer.appendChild(badgeEl);

        // GA事件：记录徽章解锁
        gtag('event', 'badge_unlocked', {
            'event_category': 'achievement',
            'event_label': topBadge.name,
            'badge_id': topBadge.id,
            'badge_name': topBadge.name
        });
    }

    // GA事件：记录收集完成进度（每次更新都上报）
    gtag('event', 'collection_complete', {
        'event_category': 'collection',
        'event_label': `${unlockedCount}/${totalCount}`,
        emperor_count: unlockedCount,
        total_count: totalCount,
        badge_level: topBadge ? topBadge.id : 'none'
    });
}

// ===== 侧边栏图鉴 =====
function toggleSidebarCollection() {
    const sidebar = document.getElementById('sidebar-collection');
    const isOpen = sidebar.classList.toggle('open');

    // 创建或移除遮罩层
    let overlay = document.querySelector('.sidebar-overlay');
    if (isOpen) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.onclick = toggleSidebarCollection;
            document.body.appendChild(overlay);
        }
        setTimeout(() => overlay.classList.add('show'), 10);
        renderSidebarCollection();
    } else {
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        }
    }
}

function renderSidebarCollection() {
    const container = document.getElementById('sidebar-collection-content');
    const collection = getCollection();

    container.innerHTML = '';

    // 按分类分组
    const categories = {};
    emperors.forEach((emperor, index) => {
        const catKey = emperor.category || 'other';
        if (!categories[catKey]) {
            categories[catKey] = [];
        }
        categories[catKey].push({ emperor, index });
    });

    // 按分类顺序渲染
    const categoryOrder = ['founder', 'golden', 'conqueror', 'keeper', 'reformer', 'artist', 'tragic', 'eccentric'];

    categoryOrder.forEach(catKey => {
        if (!categories[catKey]) return;

        const catInfo = emperorCategories[catKey];
        const catUnlocked = categories[catKey].filter(({ index }) => collection[index] !== undefined).length;
        const catTotal = categories[catKey].length;

        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'sidebar-category';
        categoryDiv.innerHTML = `
            <div class="sidebar-category-header" onclick="toggleCategory(this)">
                <div class="sidebar-category-title">
                    <span class="sidebar-category-icon">${catInfo.icon}</span>
                    <span>${catInfo.name}</span>
                </div>
                <span class="sidebar-category-count">${catUnlocked}/${catTotal}</span>
            </div>
            <div class="sidebar-category-grid">
                ${categories[catKey].map(({ emperor, index }) => {
            const isUnlocked = collection[index] !== undefined;
            return `
                        <div class="sidebar-emperor-thumb ${isUnlocked ? 'unlocked' : 'locked'}" title="${isUnlocked ? emperor.name : '未解锁'}">
                            ${isUnlocked ? `
                                <img src="assets/${emperor.id}.jpg" alt="${emperor.name}" loading="lazy">
                                <span class="thumb-name">${emperor.name}</span>
                            ` : ''}
                        </div>
                    `;
        }).join('')}
            </div>
        `;

        container.appendChild(categoryDiv);
    });
}

function toggleCategory(header) {
    const grid = header.nextElementSibling;
    grid.style.display = grid.style.display === 'none' ? 'grid' : 'none';
}

// ===== 精简版题目筛选（从36题中选12道最具区分度的）=====
const SHORT_MODE_QUESTIONS = [
    // 少年期 4题
    1,   // 年幼登基，大权旁落
    3,   // 宦官集团拉拢
    5,   // 边疆将领拥兵自重
    7,   // 国库空虚

    // 壮年期 4题
    12,  // 兄弟争储
    15,  // 巨型工程
    18,  // 外敌入侵
    22,  // 改革变法

    // 老年期 4题
    29,  // 太子被废
    32,  // 继承人选择
    34,  // 权臣威胁
    36   // 身后评价
];

// ===== 阶段标签映射 =====
const STAGE_LABELS = {
    '少年': '少年期',
    '壮年': '壮年期',
    '老年': '老年期'
};

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    initModeSelection();
    loadTargetEmperorOptions();
    updateCollectionProgress(); // 初始化图鉴进度
    updateBadges(); // 初始化徽章
});

// ===== 模式选择初始化 =====
function initModeSelection() {
    const startBtn = document.getElementById('btn-start');

    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }
}

// ===== 选择模式 =====
function selectMode(mode) {
    gameState.mode = mode;

    // 更新UI
    document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`.mode-card[data-mode="${mode}"]`).classList.add('selected');

    // 启用开始按钮
    const startBtn = document.getElementById('btn-start');
    startBtn.disabled = false;
    startBtn.textContent = mode === 'simple' ? '开始精简版测试' : '开始完整版测试';

    // GA事件：选择模式
    gtag('event', 'select_mode', {
        'event_category': 'game',
        'event_label': mode === 'simple' ? '精简版' : '完整版'
    });
}

// ===== 开始游戏 =====
function startGame() {
    if (!gameState.mode) return;

    // 记录开始时间
    gameState.gameStartTime = Date.now();

    // 筛选题目
    if (gameState.mode === 'simple') {
        gameState.filteredQuestions = allQuestions.filter(q =>
            SHORT_MODE_QUESTIONS.includes(q.id)
        );
    } else {
        gameState.filteredQuestions = [...allQuestions];
    }

    // 重置状态
    gameState.currentQuestion = 0;
    gameState.answers = {};

    // 切换界面
    document.getElementById('screen-home').classList.remove('active');
    document.getElementById('screen-home').classList.add('hidden');
    document.getElementById('screen-quiz').classList.remove('hidden');
    document.getElementById('screen-quiz').classList.add('active');

    // 显示第一题
    showQuestion();

    // GA事件：记录测试开始
    gtag('event', 'quiz_start', {
        'event_category': 'engagement',
        'event_label': gameState.mode === 'simple' ? '精简版' : '完整版',
        'mode': gameState.mode,
        'target_emperor': gameState.targetEmperorIndex !== null ? emperors[gameState.targetEmperorIndex]?.name || 'unknown' : 'none'
    });
}

// ===== 显示题目 =====
function showQuestion() {
    const question = gameState.filteredQuestions[gameState.currentQuestion];
    const totalQuestions = gameState.filteredQuestions.length;

    // 更新进度
    document.getElementById('progress-text').textContent =
        `${gameState.currentQuestion + 1} / ${totalQuestions}`;
    document.getElementById('progress-bar-fill').style.width =
        `${((gameState.currentQuestion + 1) / totalQuestions) * 100}%`;

    // 更新阶段标签
    const stageBadge = document.getElementById('stage-badge');
    const stageDesc = document.getElementById('stage-desc');
    stageBadge.textContent = STAGE_LABELS[question.stage];

    // 更新阶段描述
    stageDesc.textContent = question.stageDesc || '';

    // 更新阶段样式
    stageBadge.className = 'stage-badge';
    if (question.stage === '少年') stageBadge.classList.add('stage-youth');
    if (question.stage === '壮年') stageBadge.classList.add('stage-prime');
    if (question.stage === '老年') stageBadge.classList.add('stage-old');

    // 更新题目
    document.getElementById('question-text').textContent = question.question;

    // 更新选项
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    // 如果设置了目标皇帝，获取他在这道题上的答案
    let targetEmperorAnswer = null;
    let targetEmperor = null;
    if (gameState.targetEmperorIndex !== null && gameState.targetEmperorIndex !== "" && gameState.targetEmperorIndex !== undefined) {
        targetEmperor = emperors[gameState.targetEmperorIndex];
        if (targetEmperor) {
            const answerIndex = question.id - 1;
            targetEmperorAnswer = targetEmperor.answers[answerIndex];
        }
    }

    question.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        const valueMap = { 'MAX': 3, 'HIGH': 2, 'LOW': 1, 'MIN': 0 };
        const value = valueMap[option.type];

        // 四角回纹装饰
        btn.innerHTML += '<span class="corner-tr"></span><span class="corner-bl"></span><span class="corner-br"></span>';

        // 选项文字容器
        const textSpan = document.createElement('span');
        textSpan.className = 'option-text';
        textSpan.textContent = option.text;
        btn.appendChild(textSpan);

        // 如果这是目标皇帝会选的选项，添加标记
        if (targetEmperorAnswer !== null && targetEmperorAnswer !== undefined && value === targetEmperorAnswer) {
            btn.classList.add('target-emperor-choice');
            // 添加小标签显示目标皇帝名字
            const tag = document.createElement('span');
            tag.className = 'target-emperor-tag';
            tag.textContent = targetEmperor.name;
            btn.appendChild(tag);
        }

        btn.addEventListener('click', () => selectAnswer(question.id, value, btn));
        optionsContainer.appendChild(btn);
    });
}

// ===== 选择答案 =====
function selectAnswer(questionId, value, btnElement) {
    // 保存答案
    gameState.answers[questionId] = value;

    // 更新UI选中状态
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    btnElement.classList.add('selected');

    // GA事件：记录答题选择
    const valueLabels = { 3: 'MAX', 2: 'HIGH', 1: 'LOW', 0: 'MIN' };
    gtag('event', 'answer_question', {
        'event_category': 'quiz',
        'event_label': `Q${questionId}`,
        'value': value
    });

    // 延迟后进入下一题或显示结果
    setTimeout(() => {
        if (gameState.currentQuestion < gameState.filteredQuestions.length - 1) {
            gameState.currentQuestion++;
            showQuestion();
        } else {
            showLoading();
        }
    }, 400);
}

// ===== 显示加载页 =====
function showLoading() {
    document.getElementById('screen-quiz').classList.remove('active');
    document.getElementById('screen-quiz').classList.add('hidden');
    document.getElementById('screen-loading').classList.remove('hidden');
    document.getElementById('screen-loading').classList.add('active');

    // 模拟加载动画
    const stages = [
        { id: 'stage-1', text: '提取权力偏好...' },
        { id: 'stage-2', text: '比对历史原型...' },
        { id: 'stage-3', text: '生成匹配结果...' }
    ];

    stages.forEach((stage, index) => {
        setTimeout(() => {
            document.getElementById('loading-subtext').textContent = stage.text;
            document.getElementById(stage.id).classList.add('active');
        }, index * 600);
    });

    // 3秒后显示结果
    setTimeout(() => {
        showResult();
    }, 2000);
}



// ===== 计算匹配结果 =====
function calculateMatch() {
    const userVector = [];

    // 构建用户答案向量
    gameState.filteredQuestions.forEach(q => {
        userVector.push(gameState.answers[q.id] !== undefined ? gameState.answers[q.id] : 1);
    });

    // 计算与每位皇帝的欧几里得距离
    const matches = emperors.map(emperor => {
        // 根据筛选的题目构建皇帝答案向量
        const emperorVector = [];
        gameState.filteredQuestions.forEach(q => {
            // allQuestions 的 id 是从 1 开始的，answers 数组索引是 id-1
            const answerIndex = q.id - 1;
            emperorVector.push(emperor.answers[answerIndex] !== undefined ? emperor.answers[answerIndex] : 1);
        });

        // 计算欧几里得距离
        let distance = 0;
        for (let i = 0; i < userVector.length; i++) {
            distance += Math.pow(userVector[i] - emperorVector[i], 2);
        }
        distance = Math.sqrt(distance);

        // 计算相似度（0-100%）
        const maxDistance = Math.sqrt(userVector.length * 9); // 最大可能距离 (3-0)^2 = 9
        const similarity = Math.max(0, 100 - (distance / maxDistance * 100));

        return {
            emperor: emperor,
            distance: distance,
            similarity: Math.round(similarity),
            userVector: userVector,
            emperorVector: emperorVector
        };
    });

    // 按距离排序，返回最匹配的
    matches.sort((a, b) => a.distance - b.distance);

    return {
        best: matches[0],
        top3: matches.slice(0, 3)
    };
}

// ===== 显示结果 =====
function showResult() {
    document.getElementById('screen-loading').classList.remove('active');
    document.getElementById('screen-loading').classList.add('hidden');
    document.getElementById('screen-result').classList.remove('hidden');
    document.getElementById('screen-result').classList.add('active');

    const matchResult = calculateMatch();
    const bestMatch = matchResult.best;
    const emperor = bestMatch.emperor;

    // 解锁图鉴
    const emperorIndex = emperors.findIndex(e => e.id === emperor.id);
    const isNewUnlock = unlockEmperor(emperorIndex);

    // 如果是新解锁，可以在这里添加提示动画（可选）
    if (isNewUnlock) {
        console.log(`🎉 解锁新皇帝：${emperor.name}`);
    }

    // 显示皇帝信息
    document.getElementById('result-name').textContent = emperor.name;
    document.getElementById('result-title').textContent = emperor.title;

    // 显示匹配模式标签
    document.getElementById('match-mode-tag').textContent =
        gameState.mode === 'simple' ? '精简版匹配' : '完整版匹配';

    // 显示画像
    const portrait = document.getElementById('result-img');
    portrait.src = `assets/${emperor.id}.jpg`;
    portrait.alt = emperor.name;

    // 显示风格标签
    const tagsContainer = document.getElementById('trait-badges');
    tagsContainer.innerHTML = '';
    emperor.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'trait-badge';
        span.textContent = tag;
        tagsContainer.appendChild(span);
    });

    // 显示描述（为什么会是这个人）
    document.getElementById('result-desc').textContent = emperor.desc || '';

    // 显示事迹
    document.getElementById('result-history').textContent = emperor.history || emperor.desc || '';

    // 显示决策风格分析
    document.getElementById('decision-analysis').innerHTML = generateStyleAnalysis(emperor, bestMatch);

    // 显示Top3匹配
    const top3Container = document.getElementById('similar-emperors');
    top3Container.innerHTML = '';
    matchResult.top3.slice(1).forEach((match, index) => {
        const item = document.createElement('div');
        item.className = 'similar-emperor-item';
        item.innerHTML = `
            <span class="rank">${index + 2}</span>
            <span class="name">${match.emperor.name}</span>
            <span class="similarity">${match.similarity}%</span>
        `;
        top3Container.appendChild(item);
    });

    // 显示分享文案
    document.getElementById('share-text-content').textContent =
        `我在「你最像哪位中国皇帝」测试中，匹配到了${emperor.name}！${emperor.title}。快来测测你最像谁吧！https://testhuangdi.netlify.app/`;

    // GA事件：记录测试结果
    gtag('event', 'quiz_result', {
        'event_category': 'result',
        'event_label': emperor.name,
        'value': Math.round(bestMatch.similarity)
    });

    // GA事件：记录测试完成（用于统计总人数）
    gtag('event', 'quiz_complete', {
        'event_category': 'engagement',
        'event_label': gameState.mode === 'simple' ? '精简版完成' : '完整版完成'
    });

    // GA事件：记录匹配到的皇帝
    gtag('event', 'emperor_matched', {
        'event_category': 'result',
        'event_label': emperor.name,
        'emperor_name': emperor.name,
        'similarity': bestMatch.similarity,
        'mode': gameState.mode
    });

    // GA用户属性：记录匹配结果
    gtag('set', 'user_properties', {
        matched_emperor: emperor.name,
        quiz_mode: gameState.mode === 'simple' ? 'simple' : 'full'
    });

    // 显示统计数据
    displayStats(emperor.name);

    // 绑定结果页按钮事件
    bindResultButtons();
}

// ===== 绑定结果页按钮 =====
function bindResultButtons() {
    document.getElementById('btn-restart')?.addEventListener('click', restartGame);
    document.getElementById('btn-switch-mode')?.addEventListener('click', switchMode);
    document.getElementById('btn-share')?.addEventListener('click', shareResult);
}

// ===== 重新开始 =====
function restartGame() {
    gameState.currentQuestion = 0;
    gameState.answers = {};

    document.getElementById('screen-result').classList.remove('active');
    document.getElementById('screen-result').classList.add('hidden');
    document.getElementById('screen-home').classList.remove('hidden');
    document.getElementById('screen-home').classList.add('active');

    // 重置模式选择
    document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-start').textContent = '请先选择模式';
    gameState.mode = null;
}

// ===== 切换模式 =====
function switchMode() {
    gameState.mode = null;
    gameState.currentQuestion = 0;
    gameState.answers = {};

    document.getElementById('screen-result').classList.remove('active');
    document.getElementById('screen-result').classList.add('hidden');
    document.getElementById('screen-home').classList.remove('hidden');
    document.getElementById('screen-home').classList.add('active');

    // 重置模式选择
    document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-start').textContent = '请先选择模式';
}

// ===== 分享结果 =====
function shareResult() {
    const shareText = document.getElementById('share-text-content').textContent;

    if (navigator.share) {
        navigator.share({
            title: '你最像哪位中国皇帝',
            text: shareText,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            alert('结果已复制到剪贴板！');
        });
    }
}

// ===== 反馈功能 =====
function fb(type) {
    // GA事件：记录用户反馈
    gtag('event', 'result_feedback', {
        'event_category': 'feedback',
        'event_label': type
    });
    alert(`感谢反馈：${type}`);
}

// ===== 将游戏结果写入 Supabase =====
async function saveGameResult(emperorName) {
    if (!supabaseClient) return false;

    const durationSeconds = gameState.gameStartTime
        ? Math.round((Date.now() - gameState.gameStartTime) / 1000)
        : null;

    // 构建 raw_answers：将用户答案格式化为结构化 JSON
    const rawAnswers = {};
    Object.entries(gameState.answers).forEach(([questionId, value]) => {
        rawAnswers[`Q${questionId}`] = value;
    });

    try {
        const { error } = await supabaseClient
            .from('game_analytics')
            .insert([{
                emperor_name: emperorName,
                mode: gameState.mode,
                duration_seconds: durationSeconds,
                raw_answers: rawAnswers
                // user_ip 不传，让数据库自动获取或留空（Supabase 不支持自动获取 IP，需要通过 Edge Function 或服务端）
            }]);

        if (error) {
            console.error('Supabase 写入失败:', error);
            return false;
        }
        console.log('✅ 游戏结果已写入 Supabase');
        return true;
    } catch (e) {
        console.error('Supabase 写入异常:', e);
        return false;
    }
}

// ===== 从 Supabase 获取统计数据 =====
async function fetchStatsFromSupabase(emperorName) {
    if (!supabaseClient) return null;

    try {
        // 查询该皇帝的总匹配数
        const { count: sameEmperorCount, error: countError } = await supabaseClient
            .from('game_analytics')
            .select('*', { count: 'exact', head: true })
            .eq('emperor_name', emperorName);

        if (countError) throw countError;

        // 查询总游戏次数
        const { count: totalCount, error: totalError } = await supabaseClient
            .from('game_analytics')
            .select('*', { count: 'exact', head: true });

        if (totalError) throw totalError;

        return {
            sameEmperorCount: sameEmperorCount || 0,
            totalCount: totalCount || 0
        };
    } catch (e) {
        console.error('Supabase 统计查询失败:', e);
        return null;
    }
}

// ===== 显示统计数据（修复版本）=====
async function displayStats(emperorName) {
    // 1. 初始化显示，避免旧数据干扰
    document.getElementById('stat-count').textContent = '...';
    document.getElementById('stat-percent').textContent = '...%';

    // 2. 【关键】先保存，等待写入完成后再查询，确保包含本次结果
    await saveGameResult(emperorName);

    // 3. 查询最新统计
    const stats = await fetchStatsFromSupabase(emperorName);

    if (stats) {
        const { sameEmperorCount, totalCount } = stats;

        // 4. 【核心修复】计算比例
        // 不要使用 Math.round，因为它会把 0.4% 直接变成 0%
        // 使用 toFixed(1) 保留一位小数，更加精确
        let percentage = 0;
        if (totalCount > 0) {
            percentage = ((sameEmperorCount / totalCount) * 100).toFixed(1);
        }

        // 5. 更新 DOM
        document.getElementById('stat-count').textContent = sameEmperorCount;
        document.getElementById('stat-percent').textContent = percentage + '%';

        // 调试用：在控制台打印原始数据，如果还是 0，检查这里
        console.log(`Debug Stats: Same=${sameEmperorCount}, Total=${totalCount}, Result=${percentage}%`);
    }
}

// ===== 生成决策风格分析 =====
function generateStyleAnalysis(emperor, match) {
    const analysis = [];

    // 分析用户的权力集中度倾向
    const avgScore = match.userVector.reduce((a, b) => a + b, 0) / match.userVector.length;

    let styleDesc = '';
    if (avgScore > 2.2) {
        styleDesc = '你的决策风格偏向<strong>强势集权</strong>，倾向于主动出击、掌控全局。';
    } else if (avgScore > 1.5) {
        styleDesc = '你的决策风格偏向<strong>务实平衡</strong>，懂得在权力与稳定之间取舍。';
    } else {
        styleDesc = '你的决策风格偏向<strong>稳健保守</strong>，倾向于维护现有秩序、避免激进变革。';
    }

    analysis.push(`<p>${styleDesc}</p>`);
    analysis.push(`<p>你与 ${emperor.name} 的相似度为 <strong>${match.similarity}%</strong>。</p>`);

    return analysis.join('');
}

// ===== 显示关键选择对比 =====
function showKeyChoices(emperor, match) {
    const container = document.getElementById('key-choices');
    container.innerHTML = '';

    // 找出用户与皇帝选择最相似的3道题
    const similarities = [];
    for (let i = 0; i < match.userVector.length; i++) {
        const diff = Math.abs(match.userVector[i] - match.emperorVector[i]);
        similarities.push({ index: i, diff: diff });
    }
    similarities.sort((a, b) => a.diff - b.diff);

    // 显示最相似的3道题
    similarities.slice(0, 3).forEach(item => {
        const question = gameState.filteredQuestions[item.index];
        const userAnswer = question.options.find(o => o.value === match.userVector[item.index]);
        const emperorAnswer = question.options.find(o => o.value === match.emperorVector[item.index]);

        const choiceDiv = document.createElement('div');
        choiceDiv.className = 'key-choice-item';
        choiceDiv.innerHTML = `
            <div class="choice-question">${question.text.substring(0, 30)}...</div>
            <div class="choice-compare">
                <span class="your-choice">你的选择：${userAnswer.text.substring(0, 15)}...</span>
                <span class="emperor-choice">${emperor.name}：${emperorAnswer.text.substring(0, 15)}...</span>
            </div>
        `;
        container.appendChild(choiceDiv);
    });
}

// ===== 切换答案路径显示/隐藏 =====
function toggleAnswerPath() {
    const content = document.getElementById('answer-path-content');
    const icon = document.getElementById('answer-path-toggle');

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.textContent = '▲';
    } else {
        content.classList.add('hidden');
        icon.textContent = '▼';
    }
}

// ===== 显示标准答案路径 =====
function displayAnswerPath(emperor) {
    const container = document.getElementById('answer-path-list');
    container.innerHTML = '';

    // 重置折叠状态
    document.getElementById('answer-path-content').classList.add('hidden');
    document.getElementById('answer-path-toggle').textContent = '▼';

    // 遍历当前模式下的所有题目
    gameState.filteredQuestions.forEach((question, index) => {
        // 获取皇帝在这道题上的答案（0-3）
        const answerIndex = question.id - 1;
        const emperorScore = emperor.answers[answerIndex];

        // 根据分数找到对应的选项类型
        const typeMap = { 3: 'MAX', 2: 'HIGH', 1: 'LOW', 0: 'MIN' };
        const targetType = typeMap[emperorScore];

        // 找到对应的选项
        const targetOption = question.options.find(o => o.type === targetType);

        if (targetOption) {
            const item = document.createElement('div');
            item.className = 'answer-path-item';

            // 阶段标签
            const stageClass = question.stage === '少年' ? 'stage-youth' :
                question.stage === '壮年' ? 'stage-prime' : 'stage-old';

            item.innerHTML = `
                <div class="answer-path-question">
                    <span class="answer-path-stage ${stageClass}">${question.stage}</span>
                    <span class="answer-path-num">Q${index + 1}</span>
                    <span class="answer-path-text">${question.question}</span>
                </div>
                <div class="answer-path-option">
                    <span class="answer-path-type ${targetType.toLowerCase()}">${getTypeLabel(targetType)}</span>
                    <span class="answer-path-option-text">${targetOption.text}</span>
                </div>
            `;
            container.appendChild(item);
        }
    });
}

// ===== 获取选项类型标签 =====
function getTypeLabel(type) {
    const labels = {
        'MAX': '激进',
        'HIGH': '积极',
        'LOW': '保守',
        'MIN': '回避'
    };
    return labels[type] || type;
}

// ===== 切换皇帝攻略查询器显示/隐藏 =====
function toggleEmperorGuide() {
    const content = document.getElementById('emperor-guide-content');
    const icon = document.getElementById('emperor-guide-toggle');

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.textContent = '▲';
        // 首次展开时加载皇帝列表
        loadEmperorOptions();
    } else {
        content.classList.add('hidden');
        icon.textContent = '▼';
    }
}

// ===== 加载皇帝下拉选项 =====
function loadEmperorOptions() {
    const select = document.getElementById('emperor-select');
    if (select.options.length > 1) return; // 已加载过

    emperors.forEach((emperor, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${emperor.name} (${emperor.title})`;
        select.appendChild(option);
    });
}

// ===== 显示选中皇帝的攻略 =====
function showEmperorGuide() {
    const select = document.getElementById('emperor-select');
    const resultContainer = document.getElementById('emperor-guide-result');
    const emperorIndex = select.value;

    if (!emperorIndex) {
        resultContainer.innerHTML = '';
        return;
    }

    const emperor = emperors[emperorIndex];
    const questions = gameState.mode === 'short' ? allQuestions.filter(q => q.id % 3 === 1) : allQuestions;

    resultContainer.innerHTML = buildEmperorGuideHTML(emperor, questions);
}

// ===== 构建皇帝攻略HTML =====
function buildEmperorGuideHTML(emperor, questions) {
    // 构建皇帝信息头部
    let html = `
        <div class="emperor-guide-info">
            <img src="${emperor.image}" alt="${emperor.name}" class="emperor-guide-avatar">
            <div>
                <div class="emperor-guide-name">${emperor.name}</div>
                <div class="emperor-guide-title">${emperor.title} · ${emperor.dynasty}</div>
            </div>
        </div>
        <div class="emperor-guide-answers">
    `;

    // 遍历题目生成攻略
    questions.forEach((question, index) => {
        const answerIndex = question.id - 1;
        const emperorScore = emperor.answers[answerIndex];
        const typeMap = { 3: 'MAX', 2: 'HIGH', 1: 'LOW', 0: 'MIN' };
        const targetType = typeMap[emperorScore];
        const targetOption = question.options.find(o => o.type === targetType);

        if (targetOption) {
            const stageClass = question.stage === '少年' ? 'stage-youth' :
                question.stage === '壮年' ? 'stage-prime' : 'stage-old';

            html += `
                <div class="guide-answer-item">
                    <div class="guide-answer-header">
                        <span class="guide-answer-stage ${stageClass}">${question.stage}</span>
                        <span class="guide-answer-num">Q${index + 1}</span>
                        <span class="guide-answer-text">${question.question}</span>
                    </div>
                    <div class="guide-answer-option">
                        <span class="guide-answer-type ${targetType.toLowerCase()}">${getTypeLabel(targetType)}</span>
                        <span class="guide-answer-option-text">${targetOption.text}</span>
                    </div>
                </div>
            `;
        }
    });

    html += '</div>';
    return html;
}

// ===== 显示独立皇帝攻略页面 =====
function showStandaloneGuide() {
    document.getElementById('screen-home').classList.remove('active');
    document.getElementById('screen-home').classList.add('hidden');
    document.getElementById('screen-standalone-guide').classList.remove('hidden');
    document.getElementById('screen-standalone-guide').classList.add('active');
    loadStandaloneEmperorOptions();
}

// ===== 加载独立页面的皇帝选项 =====
function loadStandaloneEmperorOptions() {
    const select = document.getElementById('standalone-emperor-select');
    if (select.options.length > 1) return; // 已加载过

    emperors.forEach((emperor, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${emperor.name} (${emperor.title})`;
        select.appendChild(option);
    });
}

// ===== 加载目标皇帝选择器选项 =====
function loadTargetEmperorOptions() {
    const select = document.getElementById('target-emperor-select');
    if (select.options.length > 1) return; // 已加载过

    emperors.forEach((emperor, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${emperor.name} (${emperor.title})`;
        select.appendChild(option);
    });
}

// ===== 选择目标皇帝 =====
function selectTargetEmperor() {
    const select = document.getElementById('target-emperor-select');
    gameState.targetEmperorIndex = select.value ? parseInt(select.value) : null;
}

// ===== 显示独立页面的皇帝攻略 =====
function showStandaloneEmperorGuide() {
    const select = document.getElementById('standalone-emperor-select');
    const resultContainer = document.getElementById('standalone-guide-result');
    const emperorIndex = select.value;

    if (!emperorIndex) {
        resultContainer.innerHTML = `
            <div class="guide-placeholder">
                <p>👆 请从上方选择一位皇帝</p>
            </div>
        `;
        return;
    }

    const emperor = emperors[emperorIndex];
    // 独立页面默认显示完整版36题
    resultContainer.innerHTML = buildEmperorGuideHTML(emperor, allQuestions);
}

// ===== 返回首页 =====
function backToHome() {
    document.getElementById('screen-standalone-guide').classList.remove('active');
    document.getElementById('screen-standalone-guide').classList.add('hidden');
    document.getElementById('screen-home').classList.remove('hidden');
    document.getElementById('screen-home').classList.add('active');
}

// ===== 显示图鉴页面 =====
function showCollection() {
    document.getElementById('screen-home').classList.remove('active');
    document.getElementById('screen-home').classList.add('hidden');
    document.getElementById('screen-collection').classList.remove('hidden');
    document.getElementById('screen-collection').classList.add('active');

    renderCollection();
    updateCollectionProgress();

    // GA事件：记录图鉴页面访问
    const collection = getCollection();
    const unlockedCount = Object.keys(collection).length;
    gtag('event', 'collection_view', {
        'event_category': 'engagement',
        'event_label': `${unlockedCount}/${emperors.length}`,
        unlocked_count: unlockedCount,
        total_count: emperors.length
    });
}

// ===== 从图鉴返回首页 =====
function backToHomeFromCollection() {
    document.getElementById('screen-collection').classList.remove('active');
    document.getElementById('screen-collection').classList.add('hidden');
    document.getElementById('screen-home').classList.remove('hidden');
    document.getElementById('screen-home').classList.add('active');
}

// ===== 渲染图鉴 =====
function renderCollection() {
    const container = document.getElementById('collection-grid');
    const collection = getCollection();

    container.innerHTML = '';

    // 按分类分组
    const categories = {};
    emperors.forEach((emperor, index) => {
        const catKey = emperor.category || 'other';
        if (!categories[catKey]) {
            categories[catKey] = [];
        }
        categories[catKey].push({ emperor, index });
    });

    // 按分类顺序渲染
    const categoryOrder = ['founder', 'golden', 'conqueror', 'keeper', 'reformer', 'artist', 'tragic', 'eccentric'];

    categoryOrder.forEach(catKey => {
        if (!categories[catKey]) return;

        const catInfo = emperorCategories[catKey];
        const catUnlocked = categories[catKey].filter(({ index }) => collection[index] !== undefined).length;
        const catTotal = categories[catKey].length;

        // 创建分类区块
        const section = document.createElement('div');
        section.className = 'collection-category-section';
        section.innerHTML = `
            <div class="collection-category-header">
                <div class="category-title">
                    <span class="category-icon">${catInfo.icon}</span>
                    <span class="category-name">${catInfo.name}</span>
                    <span class="category-desc">${catInfo.desc}</span>
                </div>
                <div class="category-progress">
                    <span class="category-count">${catUnlocked}/${catTotal}</span>
                </div>
            </div>
            <div class="collection-category-grid"></div>
        `;

        const grid = section.querySelector('.collection-category-grid');

        categories[catKey].forEach(({ emperor, index }) => {
            const isUnlocked = collection[index] !== undefined;
            const card = document.createElement('div');
            card.className = `collection-card ${isUnlocked ? 'unlocked' : 'locked'}`;

            if (isUnlocked) {
                card.innerHTML = `
                    <div class="collection-card-image">
                        <img src="assets/${emperor.id}.jpg" alt="${emperor.name}" loading="lazy">
                    </div>
                    <div class="collection-card-info">
                        <h3 class="collection-card-name">${emperor.name}</h3>
                        <p class="collection-card-title">${emperor.title}</p>
                        <p class="collection-card-dynasty">${emperor.dynasty}</p>
                        <div class="collection-card-tags">
                            ${emperor.tags.slice(0, 3).map(tag => `<span class="collection-tag">${tag}</span>`).join('')}
                        </div>
                    </div>
                `;
            } else {
                card.innerHTML = `
                    <div class="collection-card-image locked-image">
                        <span class="locked-icon">?</span>
                    </div>
                    <div class="collection-card-info">
                        <h3 class="collection-card-name locked-name">???</h3>
                        <p class="collection-card-title">未解锁</p>
                        <p class="collection-card-dynasty">完成测试以解锁</p>
                    </div>
                `;
            }

            grid.appendChild(card);
        });

        container.appendChild(section);
    });
}


