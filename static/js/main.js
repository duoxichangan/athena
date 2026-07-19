/**
 * Athena — 运动员姿态识别平台  前端交互逻辑
 */

(function () {
    "use strict";

    // ---- DOM refs ---------------------------------------------------
    const uploadArea = document.getElementById("uploadArea");
    const fileInput = document.getElementById("fileInput");
    const uploadInfo = document.getElementById("uploadInfo");
    const filenameEl = document.getElementById("filename");
    const fileSizeEl = document.getElementById("fileSize");
    const btnUpload = document.getElementById("btnUpload");
    const btnCancel = document.getElementById("btnCancel");

    const progressSection = document.getElementById("progressSection");
    const progressText = document.getElementById("progressText");
    const progressTime = document.getElementById("progressTime");

    const resultSection = document.getElementById("resultSection");
    const statsGrid = document.getElementById("statsGrid");
    const playerCount = document.getElementById("playerCount");
    const playerGallery = document.getElementById("playerGallery");
    const btnDownload = document.getElementById("btnDownload");
    const btnDownloadData = document.getElementById("btnDownloadData");
    const btnReset = document.getElementById("btnReset");

    const errorSection = document.getElementById("errorSection");
    const errorMessage = document.getElementById("errorMessage");
    const btnRetry = document.getElementById("btnRetry");

    let selectedFile = null;
    let currentTaskId = null;
    let pollTimer = null;

    // ---- File selection ---------------------------------------------
    uploadArea.addEventListener("click", () => fileInput.click());

    uploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadArea.classList.remove("dragover");
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFile(files[0]);
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) handleFile(fileInput.files[0]);
    });

    // ---- File handling ----------------------------------------------
    function handleFile(file) {
        const ext = file.name.split(".").pop().toLowerCase();
        const allowed = ["mp4", "avi", "mov", "mkv", "webm"];
        if (!allowed.includes(ext)) {
            alert(`不支持的格式 .${ext}，请上传 ${allowed.join("/")} 文件`);
            return;
        }

        if (file.size > 200 * 1024 * 1024) {
            alert("文件大小超过 200MB 限制");
            return;
        }

        selectedFile = file;
        filenameEl.textContent = file.name;
        fileSizeEl.textContent = formatSize(file.size);
        uploadInfo.style.display = "flex";
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    // ---- Upload & Process -------------------------------------------
    btnUpload.addEventListener("click", async () => {
        if (!selectedFile) return;

        // Show progress
        hideAll();
        progressSection.style.display = "block";
        progressText.textContent = "正在上传并处理视频...";

        const formData = new FormData();
        formData.append("file", selectedFile);

        try {
            const res = await fetch("/upload", { method: "POST", body: formData });
            const data = await res.json();

            if (data.error) {
                showError(data.error);
                return;
            }

            currentTaskId = data.task_id;
            startPolling(currentTaskId);
        } catch (err) {
            showError("上传失败: " + err.message);
        }
    });

    btnCancel.addEventListener("click", resetAll);

    // ---- Polling ----------------------------------------------------
    function startPolling(taskId) {
        const startTime = Date.now();

        pollTimer = setInterval(async () => {
            try {
                const res = await fetch(`/status/${taskId}`);
                const data = await res.json();

                if (data.status === "done") {
                    clearInterval(pollTimer);
                    pollTimer = null;
                    showResult(data.result);
                } else if (data.status === "error") {
                    clearInterval(pollTimer);
                    pollTimer = null;
                    showError(data.result?.error || "未知错误");
                } else {
                    // Still processing — update progress text with elapsed time
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const mins = Math.floor(elapsed / 60);
                    const secs = elapsed % 60;
                    progressText.textContent =
                        `正在处理中... 已用时 ${mins} 分 ${secs.toString().padStart(2, "0")} 秒`;
                    if (progressTime) {
                        progressTime.textContent =
                            `已用时 ${mins}:${secs.toString().padStart(2, "0")}`;
                    }

                    // Update step indicators based on elapsed time
                    const stepProcess = document.getElementById("stepProcess");
                    if (stepProcess && elapsed > 3) {
                        stepProcess.classList.add("active");
                    }
                }
            } catch (err) {
                clearInterval(pollTimer);
                pollTimer = null;
                showError("查询状态失败: " + err.message);
            }
        }, 2000);
    }

    // ---- Result display ---------------------------------------------
    async function showResult(result) {
        hideAll();
        resultSection.style.display = "block";

        // Mark all progress steps as done
        ["stepUpload", "stepProcess", "stepComplete"].forEach(function(id) {
            var step = document.getElementById(id);
            if (step) {
                step.classList.remove("active");
                step.classList.add("done");
            }
        });

        // Stats cards (with data-target for counter animation)
        const stats = [
            { label: "跟踪球员数", value: result.unique_players },
            { label: "处理帧数", value: result.processed_frames },
            { label: "总帧数", value: result.total_frames },
            { label: "耗时 (秒)", value: result.duration_seconds },
        ];

        statsGrid.innerHTML = stats
            .map(
                (s) =>
                    `<div class="stat-card"><div class="stat-value" data-target="${s.value}">0</div><div class="stat-label">${s.label}</div></div>`
            )
            .join("");

        // Trigger counter animation after a brief delay
        setTimeout(animateCounters, 150);

        playerCount.textContent = result.unique_players;

        // Download links
        btnDownload.href = `/download/${currentTaskId}`;
        btnDownload.download = result.output_path.split("/").pop().split("\\").pop();

        btnDownloadData.href = `/data/${currentTaskId}`;
        btnDownloadData.download = result.data_path
            ? result.data_path.split("/").pop().split("\\").pop()
            : `pose_data.json`;

        // Fetch JSON data and render player gallery
        try {
            const dataRes = await fetch(`/data/${currentTaskId}`);
            const poseData = await dataRes.json();
            renderPlayerGallery(poseData, result.player_clips || {});
        } catch (err) {
            console.error("Failed to load pose data for gallery:", err);
        }
    }

    // ---- Player Gallery Rendering -----------------------------------

    // COCO 17 keypoint skeleton edges (same as backend config)
    const SKELETON_EDGES = [
        [0, 1], [0, 2], [1, 3], [2, 4],           // face
        [5, 6], [5, 7], [6, 8], [7, 9], [8, 10],   // upper body
        [5, 11], [6, 12], [11, 12],                 // torso-hip
        [11, 13], [12, 14], [13, 15], [14, 16],     // legs
    ];

    // Keypoint groups for coloring
    const KPT_GROUPS = {
        head: [0, 1, 2, 3, 4],
        torso: [5, 6, 11, 12],
        left_arm: [7, 9],
        right_arm: [8, 10],
        left_leg: [13, 15],
        right_leg: [14, 16],
    };
    const GROUP_COLORS = {
        head: "#ffffff",
        torso: "#00ffff",
        left_arm: "#ff4444",
        right_arm: "#44ff44",
        left_leg: "#ff44ff",
        right_leg: "#00ffff",
    };

    function renderPlayerGallery(poseData, playerClips) {
        playerGallery.innerHTML = "";

        // 归一化 playerClips：FastAPI 会把 int key 序列化为字符串
        const clips = {};
        if (playerClips) {
            Object.keys(playerClips).forEach(k => {
                clips[String(k)] = playerClips[k];
            });
        }

        const players = poseData.players || {};
        const ids = Object.keys(players).sort((a, b) => {
            return (players[a].track_id || 0) - (players[b].track_id || 0);
        });

        ids.forEach((tidStr) => {
            const pinfo = players[tidStr];
            const tid = pinfo.track_id;
            const clipUrl = clips[String(tid)]
                ? `/player-clip/${currentTaskId}/${tid}`
                : null;

            // Find a representative frame with valid keypoints
            const firstFrame = pinfo.frames && pinfo.frames.length > 0
                ? pinfo.frames[0]
                : null;

            const card = document.createElement("div");
            card.className = "player-card";
            card.innerHTML = `
                <div class="player-card-header">
                    <span class="player-id-badge">ID: ${tid}</span>
                    <span class="player-card-stats">
                        可见 ${pinfo.total_frames_visible} 帧 · ${pinfo.visibility_pct}%
                    </span>
                </div>
                <div class="player-media">
                    <div class="player-skeleton-panel">
                        <canvas id="skCanvas_${tid}" width="320" height="320"></canvas>
                    </div>
                    <div class="player-video-panel">
                        ${clipUrl
                            ? `<video id="pv_${tid}" src="${clipUrl}" muted loop preload="metadata"></video>`
                            : `<div style="color:#888;font-size:12px;text-align:center;padding:20px">裁剪视频<br>生成中...</div>`
                        }
                    </div>
                </div>
                <div class="analysis-result" id="analysisResult_${tid}" style="display:none;">
                    <div class="analysis-thinking" id="analysisThinking_${tid}">
                        <div class="typing-dots">
                            <span></span><span></span><span></span>
                        </div>
                        <span>AI 分析中...</span>
                    </div>
                    <div class="analysis-content" id="analysisContent_${tid}"></div>
                </div>
                <div class="player-card-footer">
                    <a class="glass-btn glass-btn-sm" href="/data/${currentTaskId}/${tid}" download>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4M8 10V2M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        姿态 JSON
                    </a>
                    ${clipUrl
                        ? `<button class="glass-btn-primary glass-btn-sm" onclick="document.getElementById('pv_${tid}').paused ? document.getElementById('pv_${tid}').play() : document.getElementById('pv_${tid}').pause()">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg>
                            播放/暂停
                           </button>
                           <a class="glass-btn glass-btn-sm" href="${clipUrl}" download>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 11V3M8 11L5 8M8 11L11 8M2 13H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            视频
                           </a>`
                        : ""
                    }
                    <button class="btn-ai glass-btn-sm" id="btnAnalyze_${tid}" onclick="window.analyzePlayer('${currentTaskId}', ${tid})">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5L8 2z" fill="currentColor"/></svg>
                        AI 分析
                    </button>
                    <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">
                        帧 ${pinfo.first_seen_frame}–${pinfo.last_seen_frame}
                    </span>
                </div>
            `;

            playerGallery.appendChild(card);

            // Draw skeleton on canvas after DOM insertion
            if (firstFrame && firstFrame.kpts) {
                setTimeout(() => {
                    const canvas = document.getElementById(`skCanvas_${tid}`);
                    if (canvas) {
                        drawSkeleton(canvas, firstFrame.kpts);
                    }
                }, 50);
            }
        });

        // Trigger scroll-reveal animation for player cards
        setTimeout(initScrollReveal, 100);
    }

    function drawSkeleton(canvas, keypoints) {
        // keypoints: [[x, y, conf], ...] — 17 keypoints in absolute pixel coords
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Find bounding box of valid keypoints to normalize
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        keypoints.forEach(([kx, ky, kc]) => {
            if (kc > 0.3) {
                minX = Math.min(minX, kx);
                minY = Math.min(minY, ky);
                maxX = Math.max(maxX, kx);
                maxY = Math.max(maxY, ky);
            }
        });

        if (!isFinite(minX)) return; // no valid keypoints

        // Add padding
        const pad = 30;
        const kptW = maxX - minX || 1;
        const kptH = maxY - minY || 1;
        const scale = Math.min((w - pad * 2) / kptW, (h - pad * 2) / kptH);
        const offsetX = (w - kptW * scale) / 2 - minX * scale;
        const offsetY = (h - kptH * scale) / 2 - minY * scale;

        function tx(kx) { return kx * scale + offsetX; }
        function ty(ky) { return ky * scale + offsetY; }

        // Draw skeleton lines
        ctx.lineWidth = 2;
        SKELETON_EDGES.forEach(([i, j]) => {
            if (keypoints[i][2] > 0.3 && keypoints[j][2] > 0.3) {
                ctx.strokeStyle = "rgba(0,255,136,0.7)";
                ctx.beginPath();
                ctx.moveTo(tx(keypoints[i][0]), ty(keypoints[i][1]));
                ctx.lineTo(tx(keypoints[j][0]), ty(keypoints[j][1]));
                ctx.stroke();
            }
        });

        // Draw keypoints
        keypoints.forEach(([kx, ky, kc], idx) => {
            if (kc < 0.3) return;

            // Determine color by group
            let color = "#00ff88"; // default
            for (const [group, indices] of Object.entries(KPT_GROUPS)) {
                if (indices.includes(idx)) {
                    color = GROUP_COLORS[group] || color;
                    break;
                }
            }

            const x = tx(kx);
            const y = ty(ky);
            const r = 4;

            // Fill
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();

            // Border
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    // ---- AI Analysis --------------------------------------------------

    /**
     * 触发单个球员的 AI 分析。
     * 挂载到 window 以便 onclick 属性调用。
     */
    window.analyzePlayer = async function (taskId, trackId, force) {
        const btn = document.getElementById(`btnAnalyze_${trackId}`);
        const resultDiv = document.getElementById(`analysisResult_${trackId}`);
        const thinkingDiv = document.getElementById(`analysisThinking_${trackId}`);
        const contentDiv = document.getElementById(`analysisContent_${trackId}`);

        if (!btn || !resultDiv) return;

        // 进入加载状态
        btn.disabled = true;
        btn.textContent = "分析中...";
        resultDiv.style.display = "block";
        thinkingDiv.style.display = "flex";
        contentDiv.innerHTML = "";

        try {
            const url = `/analyze/${taskId}/${trackId}` + (force ? "?force=true" : "");
            const res = await fetch(url, { method: "POST" });
            const data = await res.json();

            thinkingDiv.style.display = "none";

            if (data.error) {
                contentDiv.innerHTML = `<div class="analysis-error">${escapeHtml(data.error)}</div>`;
            } else {
                renderAnalysisResult(contentDiv, data.analysis, data.cached, taskId, trackId);
            }
        } catch (err) {
            thinkingDiv.style.display = "none";
            contentDiv.innerHTML = `<div class="analysis-error">❌ 网络错误: ${escapeHtml(err.message)}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = "AI 分析";
        }
    };

    /**
     * 将分析结果渲染为结构化 HTML。
     */
    function renderAnalysisResult(container, analysis, cached, taskId, trackId) {
        let html = "";

        // 缓存标记
        if (cached) {
            html += `<div class="analysis-cached-badge">缓存结果</div>`;
        }

        // 优势 (Strengths)
        if (analysis.strengths && analysis.strengths.length > 0) {
            html += `<div class="analysis-section">`;
            html += `<div class="analysis-section-title strengths">优势</div>`;
            html += `<ul class="analysis-list strengths-list">`;
            analysis.strengths.forEach(s => {
                html += `<li>${escapeHtml(s)}</li>`;
            });
            html += `</ul></div>`;
        }

        // 短板 (Weaknesses)
        if (analysis.weaknesses && analysis.weaknesses.length > 0) {
            html += `<div class="analysis-section">`;
            html += `<div class="analysis-section-title weaknesses">短板</div>`;
            html += `<ul class="analysis-list weaknesses-list">`;
            analysis.weaknesses.forEach(w => {
                html += `<li>${escapeHtml(w)}</li>`;
            });
            html += `</ul></div>`;
        }

        // 总体评价 (Summary)
        if (analysis.summary) {
            html += `<div class="analysis-section">`;
            html += `<div class="analysis-section-title summary">总体评价</div>`;
            html += `<p class="analysis-summary-text">${escapeHtml(analysis.summary)}</p>`;
            html += `</div>`;
        }

        // 改进建议 (Recommendations)
        if (analysis.recommendations && analysis.recommendations.length > 0) {
            html += `<div class="analysis-section">`;
            html += `<div class="analysis-section-title recommendations">改进建议</div>`;
            html += `<ul class="analysis-list recommendations-list">`;
            analysis.recommendations.forEach(r => {
                html += `<li>${escapeHtml(r)}</li>`;
            });
            html += `</ul></div>`;
        }

        // 补充观察建议 (Additional Angles Needed)
        if (analysis.additional_angles && analysis.additional_angles.length > 0) {
            html += `<div class="analysis-section">`;
            html += `<div class="analysis-section-title additional-angles">补充观察建议</div>`;
            html += `<ul class="analysis-list additional-angles-list">`;
            analysis.additional_angles.forEach(a => {
                html += `<li>${escapeHtml(a)}</li>`;
            });
            html += `</ul></div>`;
        }

        // 回退: 显示 raw_response
        if (!analysis.strengths && !analysis.weaknesses && !analysis.summary
            && !analysis.recommendations && !analysis.additional_angles && analysis.raw_response) {
            html += `<div class="analysis-section">`;
            html += `<p class="analysis-summary-text">${escapeHtml(analysis.raw_response)}</p>`;
            html += `</div>`;
        }

        // 重新分析按钮
        html += `<button class="btn-reanalyze" onclick="window.analyzePlayer('${taskId}', ${trackId}, true)" style="margin-top:8px;">重新分析</button>`;

        container.innerHTML = html;
    }

    /**
     * HTML 转义，防止 XSS。
     */
    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- Error -------------------------------------------------------

    function showError(msg) {
        hideAll();
        errorSection.style.display = "block";
        errorMessage.textContent = msg;
    }

    // ---- Reset ------------------------------------------------------
    btnReset.addEventListener("click", resetAll);
    btnRetry.addEventListener("click", resetAll);

    function resetAll() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        selectedFile = null;
        currentTaskId = null;
        fileInput.value = "";
        hideAll();
        uploadInfo.style.display = "none";
    }

    function hideAll() {
        uploadInfo.style.display = "none";
        progressSection.style.display = "none";
        resultSection.style.display = "none";
        errorSection.style.display = "none";

        // Reset progress step indicators
        ["stepUpload", "stepProcess", "stepComplete"].forEach(function(id) {
            var step = document.getElementById(id);
            if (step) {
                step.classList.remove("active", "done");
            }
        });
        // Re-activate first step
        var firstStep = document.getElementById("stepUpload");
        if (firstStep) firstStep.classList.add("active");

        // Reset progress time
        if (progressTime) progressTime.textContent = "已用时 0:00";
    }

    // ---- Animation Enhancements ---------------------------------------

    /**
     * Animate stat card numbers counting up from 0 to their target values.
     * Uses requestAnimationFrame with easeOut quad easing.
     */
    function animateCounters() {
        var counters = document.querySelectorAll(".stat-value[data-target]");
        counters.forEach(function(el) {
            var target = parseInt(el.getAttribute("data-target"), 10);
            if (isNaN(target)) return;

            var duration = 800;
            var startTime = performance.now();

            function update(now) {
                var elapsed = now - startTime;
                var progress = Math.min(elapsed / duration, 1);
                // easeOut quad
                var eased = 1 - (1 - progress) * (1 - progress);
                el.textContent = Math.floor(eased * target);
                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    el.textContent = target;
                }
            }

            requestAnimationFrame(update);
        });
    }

    /**
     * Initialize Intersection Observer for scroll-triggered reveal animations
     * on player cards. Cards fade in and slide up when they enter the viewport.
     */
    function initScrollReveal() {
        // Respect user's motion preferences
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            // Reveal all cards immediately
            document.querySelectorAll(".player-card").forEach(function(card) {
                card.classList.add("revealed");
            });
            return;
        }

        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("revealed");
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: "0px 0px -30px 0px"
        });

        // Observe all player cards
        document.querySelectorAll(".player-card").forEach(function(card) {
            observer.observe(card);
        });

        // Fallback: reveal any cards still hidden after 2 seconds
        setTimeout(function() {
            document.querySelectorAll(".player-card:not(.revealed)").forEach(function(card) {
                card.classList.add("revealed");
            });
        }, 2000);
    }

})();
