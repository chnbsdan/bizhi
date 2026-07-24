// ============================================
// app.js - 主脚本文件
// ============================================

// ============================================
// 1. 配置常量
// ============================================
const CONFIG = {
    particlesPerSquarePixel: 0.000005,
    particleMinSize: 1,
    particleMaxSize: 2.5,
    particleMinSpeed: 0.25,
    particleMaxSpeed: 0.5,
    particleMinLifetime: 3000,
    particleMaxLifetime: 10000,
    connectionMaxDistance: 100,
    connectionLineWidth: 1,
    maxConnectionsPerParticle: 4,
    maxTotalConnections: 750,
    mouseGravityRadius: 80,
    mouseGravityForce: -0.1,
    timeFontSizeRatio: 0.05,
    timeFontMinSize: 36,
    timeFontMaxSize: 72,
    rightPadding: 25,
    topPadding: 30
};

// ============================================
// 2. Canvas 管理器
// ============================================
class CanvasManager {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    get context() { return this.ctx; }
    get element() { return this.canvas; }
}

// ============================================
// 3. 粒子系统
// ============================================
class Particle {
    constructor(canvas) {
        this.canvas = canvas;
        const side = Math.floor(Math.random() * 4);
        switch (side) {
            case 0:
                this.x = Math.random() * canvas.width;
                this.y = -5;
                break;
            case 1:
                this.x = canvas.width + 5;
                this.y = Math.random() * canvas.height;
                break;
            case 2:
                this.x = Math.random() * canvas.width;
                this.y = canvas.height + 5;
                break;
            case 3:
                this.x = -5;
                this.y = Math.random() * canvas.height;
                break;
        }
        const speed = CONFIG.particleMinSpeed + Math.random() * (CONFIG.particleMaxSpeed - CONFIG.particleMinSpeed);
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.lifetime = CONFIG.particleMinLifetime + Math.random() * (CONFIG.particleMaxLifetime - CONFIG.particleMinLifetime);
        this.age = 0;
        this.baseSize = CONFIG.particleMinSize + Math.random() * (CONFIG.particleMaxSize - CONFIG.particleMinSize);
        this.mouseX = 0;
        this.mouseY = 0;
    }

    update(deltaTime, mouseX, mouseY) {
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= CONFIG.mouseGravityRadius && distance > 0) {
            const force = CONFIG.mouseGravityForce * (1 - distance / CONFIG.mouseGravityRadius);
            this.vx += (dx / distance) * force;
            this.vy += (dy / distance) * force;
        }
        this.x += this.vx;
        this.y += this.vy;
        this.age += deltaTime;
        const inScreen = (this.x >= -5 && this.x <= this.canvas.width + 5) &&
            (this.y >= -5 && this.y <= this.canvas.height + 5);
        return this.age < this.lifetime && inScreen;
    }

    draw(ctx) {
        const lifeProgress = this.age / this.lifetime;
        const size = Math.min(this.baseSize * (1 + lifeProgress), CONFIG.particleMaxSize);
        const opacity = Math.max(0, 1 - lifeProgress);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.particles = [];
        this.mouseX = 0;
        this.mouseY = 0;
    }

    updateMouse(x, y) {
        this.mouseX = x;
        this.mouseY = y;
    }

    generate() {
        const count = Math.floor(this.canvas.width * this.canvas.height * CONFIG.particlesPerSquarePixel);
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(this.canvas));
        }
    }

    update(deltaTime) {
        if (Math.random() < 0.1) this.generate();
        this.particles = this.particles.filter(p =>
            p.update(deltaTime, this.mouseX, this.mouseY)
        );
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }

    drawConnections(ctx) {
        const counts = new Array(this.particles.length).fill(0);
        const connections = [];
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= CONFIG.connectionMaxDistance &&
                    counts[i] < CONFIG.maxConnectionsPerParticle &&
                    counts[j] < CONFIG.maxConnectionsPerParticle &&
                    connections.length < CONFIG.maxTotalConnections) {
                    connections.push({ p1, p2 });
                    counts[i]++;
                    counts[j]++;
                }
            }
        }
        connections.forEach(({ p1, p2 }) => {
            const o1 = Math.max(0, 1 - p1.age / p1.lifetime);
            const o2 = Math.max(0, 1 - p2.age / p2.lifetime);
            const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            grad.addColorStop(0, `rgba(255, 255, 255, ${o1 * 0.5})`);
            grad.addColorStop(1, `rgba(255, 255, 255, ${o2 * 0.5})`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = CONFIG.connectionLineWidth;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        });
    }
}

// ============================================
// 4. 时间管理器（含拖拽功能）
// ============================================
class TimeManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.position = {
            x: canvas.width - CONFIG.rightPadding,
            y: CONFIG.topPadding
        };
        this.isDragging = false;
        this.isHovering = false;
        this.dragOffset = { x: 0, y: 0 };
        this.fontSize = this.calculateFontSize();
    }

    calculateFontSize() {
        let size = Math.min(this.canvas.width, this.canvas.height) * CONFIG.timeFontSizeRatio;
        return Math.max(CONFIG.timeFontMinSize, Math.min(size, CONFIG.timeFontMaxSize));
    }

    getTimeString() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    getTextMetrics() {
        const timeStr = this.getTimeString();
        this.ctx.font = `500 ${this.fontSize}px "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif`;
        const metrics = this.ctx.measureText(timeStr);
        return {
            width: metrics.width,
            height: this.fontSize,
            text: timeStr
        };
    }

    isPointOverTime(x, y) {
        const metrics = this.getTextMetrics();
        const left = this.position.x - metrics.width;
        const right = this.position.x;
        const top = this.position.y;
        const bottom = this.position.y + metrics.height;
        return x >= left && x <= right && y >= top && y <= bottom;
    }

    startDrag(mouseX, mouseY) {
        this.isDragging = true;
        this.dragOffset.x = this.position.x - mouseX;
        this.dragOffset.y = this.position.y - mouseY;
    }

    updateDrag(mouseX, mouseY) {
        if (!this.isDragging) return;
        const metrics = this.getTextMetrics();
        this.position.x = Math.max(metrics.width + 10, Math.min(this.canvas.width - 10, mouseX + this.dragOffset.x));
        this.position.y = Math.max(10, Math.min(this.canvas.height - metrics.height - 10, mouseY + this.dragOffset.y));
    }

    stopDrag() {
        this.isDragging = false;
        this.isHovering = false;
    }

    setHovering(hovering) {
        this.isHovering = hovering;
    }

    draw(ctx) {
        const timeStr = this.getTimeString();
        this.fontSize = this.calculateFontSize();
        const isActive = this.isHovering || this.isDragging;

        ctx.font = `500 ${this.fontSize}px "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';

        // 阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = isActive ? 25 : 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;

        // 描边
        ctx.shadowBlur = 0;
        ctx.lineWidth = isActive ? 3 : 2;
        ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.15)';
        ctx.strokeText(timeStr, this.position.x, this.position.y);

        // 填充
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = isActive ? 25 : 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(timeStr, this.position.x, this.position.y);

        // 提示文字
        if (isActive) {
            const hintSize = this.fontSize * 0.25;
            ctx.font = `${hintSize}px "SF Pro Display", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            const hintText = this.isDragging ? '✦ 拖动中' : '✦ 拖动移动';
            ctx.fillText(hintText, this.position.x - 10, this.position.y + this.fontSize + 8);
        }

        // 重置阴影
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    resetPosition() {
        this.position.x = this.canvas.width - CONFIG.rightPadding;
        this.position.y = CONFIG.topPadding;
    }
}

// ============================================
// 5. 渲染器
// ============================================
class Renderer {
    constructor() {
        this.canvasManager = new CanvasManager();
        this.particleSystem = new ParticleSystem(this.canvasManager.canvas);
        this.timeManager = new TimeManager(this.canvasManager.canvas);
        this.setupEvents();
        this.particleSystem.generate();
        this.lastTime = 0;
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupEvents() {
        const canvas = this.canvasManager.canvas;
        const timeManager = this.timeManager;
        const particleSystem = this.particleSystem;

        // 鼠标移动
        window.addEventListener('mousemove', (e) => {
            const x = e.clientX;
            const y = e.clientY;
            particleSystem.updateMouse(x, y);

            if (!timeManager.isDragging) {
                const hovering = timeManager.isPointOverTime(x, y);
                timeManager.setHovering(hovering);
                canvas.style.cursor = hovering ? 'grab' : 'default';
            }
        });

        // 鼠标按下
        canvas.addEventListener('mousedown', (e) => {
            if (timeManager.isHovering) {
                timeManager.startDrag(e.clientX, e.clientY);
                canvas.style.cursor = 'grabbing';
            }
        });

        // 鼠标松开
        window.addEventListener('mouseup', () => {
            if (timeManager.isDragging) {
                timeManager.stopDrag();
                canvas.style.cursor = 'default';
            }
        });

        // 鼠标离开窗口
        window.addEventListener('mouseleave', () => {
            if (timeManager.isDragging) {
                timeManager.stopDrag();
                canvas.style.cursor = 'default';
            }
        });

        // 窗口大小变化
        window.addEventListener('resize', () => {
            this.canvasManager.resize();
            timeManager.resetPosition();
        });
    }

    animate(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        const ctx = this.canvasManager.context;
        const canvas = this.canvasManager.canvas;

        // 绘制背景
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, "rgb(255, 100, 180)");
        grad.addColorStop(0.5, "rgb(200, 150, 255)");
        grad.addColorStop(1, "rgb(0, 255, 255)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 更新粒子
        this.particleSystem.update(deltaTime);

        // 更新时间位置（拖拽时）
        if (this.timeManager.isDragging) {
            this.timeManager.updateDrag(this.particleSystem.mouseX, this.particleSystem.mouseY);
        }

        // 绘制粒子连线
        this.particleSystem.drawConnections(ctx);

        // 绘制粒子
        this.particleSystem.draw(ctx);

        // 绘制时间
        this.timeManager.draw(ctx);

        requestAnimationFrame(this.animate);
    }
}

// ============================================
// 6. 启动应用
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    new Renderer();
});