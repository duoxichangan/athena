# Corporate Liquid Glass 设计系统

> **企业简洁风 × Liquid Glass 效果** — 在专业可信的企业设计语言之上，融入 Apple 最新液态玻璃视觉魔法。适合 B2B SaaS、企业官网、后台管理系统等需要高端质感与专业形象并存的场景。

---

## 目录

1. [设计理念](#1-设计理念)
2. [Liquid Glass 技术原理](#2-liquid-glass-技术原理)
3. [Token 字典](#3-token-字典)
4. [Liquid Glass 组件规范](#4-liquid-glass-组件规范)
5. [核心组件规范](#5-核心组件规范)
6. [页面骨架模板](#6-页面骨架模板)
7. [CSS 工具类扩展](#7-css-工具类扩展)
8. [React 组件实现](#8-react-组件实现)
9. [Vue 组件实现](#9-vue-组件实现)
10. [原生 HTML/CSS 实现](#10-原生-htmlcss-实现)
11. [禁止项与自检清单](#11-禁止项与自检清单)
12. [示例 Prompt 模板](#12-示例-prompt-模板)

---

## 1. 设计理念

### 1.1 双重基因

本设计系统融合了两套设计语言的核心优势：

| 维度 | Corporate Clean（底层） | Liquid Glass（增强层） |
|------|------------------------|----------------------|
| **定位** | 专业可信的企业设计基础 | 高端质感的视觉魔法层 |
| **色彩** | 纯色、扁平、克制 | 半透明、光影、景深感 |
| **质感** | 干净利落、微阴影 | 玻璃质感、光线折射 |
| **交互** | 即时反馈、微位移 | 液态流动、扭曲变形 |
| **适用** | 所有企业级界面 | Hero、卡片、弹窗、导航 |

### 1.2 核心理念

```
企业简洁风（基础层）
    ↓ 提供
排版 / 间距 / 色彩 / 无障碍 / 响应式
    ↓ 之上叠加
Liquid Glass（增强层）
    ↓ 提供
玻璃质感 / 背景扭曲 / 光影效果 / 液态交互
    ↓ 最终产出
Corporate Liquid Glass — 专业且惊艳的企业界面
```

**设计原则：**

1. **分层增强，非替代** — Liquid Glass 是装饰层，不破坏底层企业风格的结构与可读性
2. **按需使用** — 不是每个元素都需要玻璃效果；Hero、卡片、弹窗优先
3. **性能可控** — SVG 滤镜有性能成本，仅在关键视觉节点使用
4. **降级友好** — 不支持 SVG 滤镜的环境优雅降级为纯色半透明
5. **专业优先** — 玻璃效果服务于信息传达，而非喧宾夺主

### 1.3 使用场景矩阵

| 场景 | 玻璃效果强度 | 说明 |
|------|------------|------|
| Hero 区域 | ★★★★★ | 全幅玻璃球/面板，品牌第一印象 |
| 功能卡片 | ★★★☆☆ | 悬浮玻璃卡片，hover 增强 |
| 导航栏 | ★★★★☆ | 毛玻璃导航，滚动跟随 |
| 弹窗/Modal | ★★★★☆ | 玻璃态弹窗，聚焦注意力 |
| 数据仪表板 | ★★☆☆☆ | 局部玻璃装饰，不干扰数据 |
| 表单/输入 | ★☆☆☆☆ | 极克制使用，保证可用性 |
| 表格/列表 | ☆☆☆☆☆ | 不使用，保证可读性 |

---

## 2. Liquid Glass 技术原理

### 2.1 核心管线

```
SDF 距离场定义玻璃形状
        ↓
fragmentShader + smoothStep 计算每个像素位移
        ↓
updateShader 将位移数据编码为颜色 (R=水平, G=垂直)
        ↓
Canvas 生成位移贴图
        ↓
feDisplacementMap 根据贴图指令移动像素
        ↓
CSS backdrop-filter 应用 SVG 滤镜
        ↓
背景内容被"玻璃"扭曲 → 最终视觉效果
```

### 2.2 关键技术点

#### SVG feDisplacementMap 滤镜

```xml
<filter id="liquid-glass-filter">
  <!-- 位移指令贴图：R通道=水平移动, G通道=垂直移动 -->
  <feImage href="displacement-map.png" />
  <!-- 执行像素位移 -->
  <feDisplacementMap
    in="SourceGraphic"
    in2="displacement-map"
    xChannelSelector="R"
    yChannelSelector="G"
    scale="15"
  />
</filter>
```

**颜色编码规则：**
- **R=128（中性灰）**：像素不移动
- **R>128（偏红）**：像素向右移动
- **R<128（偏青）**：像素向左移动
- **G=128（中性灰）**：像素不移动
- **G>128（偏绿）**：像素向下移动
- **G<128（偏品红）**：像素向上移动

#### SDF（有向距离场）

```typescript
function roundedRectSDF(
  x: number, y: number,
  width: number, height: number,
  radius: number
): number {
  const qx = Math.abs(x) - width + radius
  const qy = Math.abs(y) - height + radius
  return (
    Math.min(Math.max(qx, qy), 0) +
    Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) -
    radius
  )
}
```

- SDF < 0：点在玻璃内部
- SDF = 0：点在玻璃边缘
- SDF > 0：点在玻璃外部

#### smoothStep 平滑过渡

```typescript
function smoothStep(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return t * t * (3 - 2 * t) // 慢→快→慢节奏，避免生硬跳变
}
```

#### 默认玻璃扭曲逻辑

```typescript
const defaultFragment = (uv: { x: number; y: number }) => {
  const ix = uv.x - 0.5 // 转换到中心坐标系
  const iy = uv.y - 0.5

  // 计算到玻璃边缘的距离
  const distanceToEdge = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6)

  // 距离越近，扭曲强度越大
  const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15)
  const scaled = smoothStep(0, 1, displacement)

  // 所有像素被"拉"向中心
  return { type: 't' as const, x: ix * scaled + 0.5, y: iy * scaled + 0.5 }
}
```

### 2.3 性能考量

| 指标 | 数值 | 说明 |
|------|------|------|
| 位移贴图生成 | ~2-5ms | Canvas 双遍计算，尺寸越大越慢 |
| SVG 滤镜渲染 | GPU 加速 | 依赖浏览器合成器 |
| 推荐贴图尺寸 | ≤ 300×200 | 平衡效果与性能 |
| 每页推荐玻璃元素数 | ≤ 5 个 | 超过时考虑懒加载/降级 |

---

## 3. Token 字典

### 3.1 色彩系统

#### 企业基础色（Corporate Clean 层）

```
主色
  primary-50:  #eff6ff
  primary-100: #dbeafe
  primary-200: #bfdbfe
  primary-500: #3b82f6  ← 主交互色
  primary-600: #2563eb  ← hover 态
  primary-700: #1d4ed8  ← active 态

中性色
  white:       #ffffff  ← 卡片/页面背景
  gray-50:     #f9fafb  ← 页面底色
  gray-100:    #f3f4f6
  gray-200:    #e5e7eb  ← 边框色
  gray-300:    #d1d5db  ← 输入框边框
  gray-400:    #9ca3af
  gray-500:    #6b7280  ← 辅助文字
  gray-700:    #374151  ← 正文
  gray-900:    #111827  ← 标题
  black:       #000000

语义色
  success:     #10b981
  warning:     #f59e0b
  error:       #ef4444
  info:        #3b82f6
```

#### 玻璃透明色（Liquid Glass 层）

```
玻璃底色
  glass-white:        rgba(255, 255, 255, 0.18)   ← 浅色背景上
  glass-white-hover:  rgba(255, 255, 255, 0.25)
  glass-dark:         rgba(0, 0, 0, 0.12)         ← 深色背景上
  glass-dark-hover:   rgba(0, 0, 0, 0.18)

玻璃边框
  glass-border-light: rgba(255, 255, 255, 0.35)
  glass-border-dark:  rgba(255, 255, 255, 0.12)

玻璃阴影
  glass-shadow-sm:    0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
  glass-shadow-md:    0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)
  glass-shadow-lg:    0 8px 32px rgba(0,0,0,0.10), 0 3px 8px rgba(0,0,0,0.05)
  glass-shadow-xl:    0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)
  glass-inner-light:  inset 0 1px 1px rgba(255,255,255,0.5)
  glass-inner-dark:   inset 0 -10px 25px rgba(0,0,0,0.08)
```

### 3.2 排版

```
字体族
  系统字体栈: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
  等宽字体栈: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace

字重
  font-normal:   400  ← 正文
  font-medium:   500  ← 按钮、强调
  font-semibold: 600  ← 标题
  font-bold:     700  ← Hero

字号（响应式）
  Hero:  text-4xl md:text-5xl lg:text-6xl   (36px → 48px → 60px)
  H1:    text-3xl md:text-4xl                (30px → 36px)
  H2:    text-2xl md:text-3xl                (24px → 30px)
  H3:    text-xl md:text-2xl                 (20px → 24px)
  H4:    text-lg md:text-xl                  (18px → 20px)
  正文:  text-sm md:text-base                (14px → 16px)
  小字:  text-xs                             (12px)
  辅助:  text-xs text-gray-500               (12px, 灰色)

行高
  heading:  leading-tight (1.25)
  body:     leading-relaxed (1.625)

字距
  heading:  tracking-tight (-0.025em)
  body:     tracking-normal
```

### 3.3 间距

```
Section 垂直间距
  section-sm: py-8 md:py-12
  section-md: py-12 md:py-16 lg:py-20   ← 默认
  section-lg: py-16 md:py-20 lg:py-24

容器水平内边距
  container-sm: px-4 md:px-6 lg:px-8    ← 默认
  container-lg: px-6 md:px-8 lg:px-12

卡片内边距
  card-sm: p-4 md:p-5
  card-md: p-6                           ← 默认
  card-lg: p-8 md:p-10

元素间距
  gap-xs:   gap-2 (8px)
  gap-sm:   gap-3 (12px)
  gap-md:   gap-4 (16px)                ← 默认
  gap-lg:   gap-6 (24px)
  gap-xl:   gap-8 (32px)
```

### 3.4 边框与圆角

```
边框
  宽度:      border (1px)
  默认颜色:  border-gray-200
  聚焦颜色:  border-blue-500

圆角（企业基础）
  rounded-sm:   4px   ← 小元素（标签、徽标）
  rounded-md:   6px   ← 输入框
  rounded-lg:   8px   ← 按钮
  rounded-xl:   12px  ← 卡片
  rounded-2xl:  16px  ← 大面板、弹窗

圆角（玻璃增强 - 更圆润）
  glass-rounded-sm:  12px
  glass-rounded-md:  16px
  glass-rounded-lg:  20px
  glass-rounded-xl:  24px
  glass-rounded-full: 9999px  ← 玻璃球效果
```

### 3.5 阴影

```
企业基础阴影（subtle / 专业）
  shadow-none:   无阴影（禁用态）
  shadow-sm:     0 1px 2px rgba(0,0,0,0.05)
  shadow:        0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)
  shadow-md:     0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)

玻璃增强阴影（更深、更散、内阴影）
  glass-shadow-sm:   0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.4)
  glass-shadow-md:   0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.35)
  glass-shadow-lg:   0 8px 32px rgba(0,0,0,0.10), 0 3px 8px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.3)
  glass-shadow-xl:   0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.25)
  glass-shadow-2xl:  0 24px 64px rgba(0,0,0,0.14), 0 6px 16px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.2)

聚焦环
  focus-ring: ring-2 ring-blue-500 ring-offset-2
```

### 3.6 动效

```
过渡
  default:    transition-all duration-200   ← 企业基础（利落、不拖沓）
  smooth:     transition-all duration-300   ← 玻璃交互（略慢，更优雅）
  slow:       transition-all duration-500   ← 场景切换

缓动
  ease-out:    cubic-bezier(0, 0, 0.2, 1)   ← 入场
  ease-in-out: cubic-bezier(0.4, 0, 0.2, 1) ← 持续动画
  spring:      cubic-bezier(0.34, 1.56, 0.64, 1) ← 弹性（谨慎使用）

交互动效
  按钮 hover:   hover:-translate-y-0.5 active:scale-[0.98]
  卡片 hover:   hover:-translate-y-1 hover:shadow-md
  玻璃 hover:   hover:backdrop-blur-lg hover:bg-white/25
  输入 focus:   focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500

无障碍
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
```

---

## 4. Liquid Glass 组件规范

### 4.1 玻璃容器基类 `.glass`

```css
/* ===== 基础玻璃容器 ===== */
.glass {
  /* 背景 */
  background: rgba(255, 255, 255, 0.18);

  /* 边框 */
  border: 1px solid rgba(255, 255, 255, 0.35);

  /* 阴影 */
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.08),
    0 2px 4px rgba(0, 0, 0, 0.04),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);

  /* 模糊 */
  backdrop-filter: blur(12px) saturate(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);

  /* 圆角 */
  border-radius: 16px;

  /* 动效 */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover：增强玻璃感 */
.glass:hover {
  background: rgba(255, 255, 255, 0.25);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.10),
    0 3px 6px rgba(0, 0, 0, 0.05),
    inset 0 1px 1px rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(16px) saturate(1.3);
}

/* ===== Liquid Glass 增强容器（含 SVG 滤镜扭曲） ===== */
.glass-liquid {
  /* 继承基础玻璃样式 */
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 16px;

  /* 核心：引用 SVG 滤镜 */
  backdrop-filter: url(#liquid-glass-filter) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1);

  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.10),
    inset 0 -10px 25px rgba(0, 0, 0, 0.06),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);

  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-liquid:hover {
  background: rgba(255, 255, 255, 0.25);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.14),
    inset 0 -10px 25px rgba(0, 0, 0, 0.10),
    inset 0 1px 1px rgba(255, 255, 255, 0.35);
}

/* ===== 深色背景上的玻璃 ===== */
.glass-dark {
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.15),
    inset 0 1px 1px rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px) saturate(1.2);
  color: white;
}

.glass-dark:hover {
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(16px) saturate(1.3);
}
```

### 4.2 玻璃强度等级

```
glass-subtle   — background: rgba(255,255,255, 0.08); backdrop-filter: blur(6px);
glass-light    — background: rgba(255,255,255, 0.12); backdrop-filter: blur(10px);
glass-default  — background: rgba(255,255,255, 0.18); backdrop-filter: blur(12px);
glass-medium   — background: rgba(255,255,255, 0.22); backdrop-filter: blur(16px);
glass-heavy    — background: rgba(255,255,255, 0.28); backdrop-filter: blur(20px);
glass-liquid   — 以上任意 + url(#liquid-glass-filter) → 添加背景扭曲
```

### 4.3 玻璃圆角等级

```
glass-rounded-sm:   12px  ← 小徽标、标签
glass-rounded-md:   16px  ← 按钮、输入框
glass-rounded-lg:   20px  ← 卡片
glass-rounded-xl:   24px  ← 面板、弹窗
glass-rounded-full: 9999px ← 圆形玻璃球
```

---

## 5. 核心组件规范

### 5.1 按钮

#### 标准按钮

```html
<!-- 主按钮 -->
<button class="
  px-4 py-2 md:px-6 md:py-3
  bg-blue-600 text-white
  rounded-lg font-medium
  transition-all duration-200
  hover:bg-blue-700 hover:-translate-y-0.5
  active:scale-[0.98]
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
">
  主要操作
</button>

<!-- 次按钮 -->
<button class="
  px-4 py-2 md:px-6 md:py-3
  bg-white text-gray-700
  border border-gray-300
  rounded-lg font-medium
  transition-all duration-200
  hover:bg-gray-50 hover:-translate-y-0.5 hover:border-gray-400
  active:scale-[0.98]
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
">
  次要操作
</button>

<!-- 幽灵按钮 -->
<button class="
  px-4 py-2 md:px-6 md:py-3
  text-blue-600
  rounded-lg font-medium
  transition-all duration-200
  hover:bg-blue-50
  active:scale-[0.98]
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
">
  文字操作
</button>
```

#### 玻璃按钮

```html
<!-- 玻璃主按钮 -->
<button class="
  px-4 py-2 md:px-6 md:py-3
  bg-white/20 text-gray-900
  border border-white/35
  rounded-lg font-medium
  backdrop-blur-md
  shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.4)]
  transition-all duration-300
  hover:bg-white/30 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.10),inset_0_1px_1px_rgba(255,255,255,0.35)]
  active:scale-[0.98]
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
">
  玻璃操作
</button>
```

### 5.2 卡片

#### 标准卡片

```html
<div class="
  bg-white
  rounded-xl
  shadow-sm
  border border-gray-200
  p-6
  transition-all duration-200
  hover:-translate-y-1 hover:shadow-md
">
  <h3 class="font-semibold tracking-tight text-xl md:text-2xl text-gray-900 mb-2">
    卡片标题
  </h3>
  <p class="text-sm md:text-base text-gray-700 leading-relaxed">
    卡片内容描述，保持信息层次清晰。
  </p>
</div>
```

#### 玻璃卡片

```html
<div class="
  bg-white/18
  rounded-[20px]
  border border-white/35
  p-6
  backdrop-blur-md
  shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.4)]
  transition-all duration-300
  hover:-translate-y-1 hover:bg-white/25
  hover:shadow-[0_8px_32px_rgba(0,0,0,0.10),0_3px_8px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.35)]
">
  <h3 class="font-semibold tracking-tight text-xl md:text-2xl text-gray-900 mb-2">
    玻璃卡片标题
  </h3>
  <p class="text-sm md:text-base text-gray-700 leading-relaxed">
    透过玻璃，隐约可见背景内容，营造空间层次感。
  </p>
</div>
```

#### Liquid Glass 卡片（含扭曲效果）

```html
<div class="
  glass-liquid
  glass-rounded-lg
  p-6
  transition-all duration-300
  hover:-translate-y-1
">
  <h3 class="font-semibold tracking-tight text-xl md:text-2xl text-gray-900 mb-2">
    液态玻璃卡片
  </h3>
  <p class="text-sm md:text-base text-gray-700 leading-relaxed">
    背景文字在玻璃边缘产生真实的扭曲变形，如同透过水晶观察世界。
  </p>
</div>
```

### 5.3 输入框

#### 标准输入框

```html
<input class="
  px-3 py-2 md:px-4 md:py-3
  border border-gray-300
  rounded-lg
  text-sm md:text-base text-gray-900
  placeholder:text-gray-400
  bg-white
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500
  disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
" placeholder="请输入..." />
```

#### 玻璃输入框

```html
<input class="
  px-3 py-2 md:px-4 md:py-3
  bg-white/15
  border border-white/30
  rounded-lg
  text-sm md:text-base text-gray-900
  placeholder:text-gray-500
  backdrop-blur-sm
  transition-all duration-300
  focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-2 focus:border-blue-400/60 focus:bg-white/25
  disabled:bg-white/5 disabled:text-gray-400 disabled:cursor-not-allowed
" placeholder="请输入..." />
```

### 5.4 导航栏

#### 标准导航

```html
<nav class="
  bg-white
  border-b border-gray-200
  px-4 md:px-8 py-3 md:py-4
">
  <div class="flex items-center justify-between max-w-6xl mx-auto">
    <a href="/" class="font-semibold text-xl tracking-tight text-gray-900">
      LOGO
    </a>
    <div class="hidden md:flex gap-6 text-sm text-gray-700">
      <a href="#" class="hover:text-blue-600 transition-colors">导航1</a>
      <a href="#" class="hover:text-blue-600 transition-colors">导航2</a>
      <a href="#" class="hover:text-blue-600 transition-colors">导航3</a>
    </div>
  </div>
</nav>
```

#### 玻璃导航（滚动跟随）

```html
<nav class="
  sticky top-0 z-50
  bg-white/60
  border-b border-white/30
  px-4 md:px-8 py-3 md:py-4
  backdrop-blur-xl saturate-150
  shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.5)]
">
  <div class="flex items-center justify-between max-w-6xl mx-auto">
    <a href="/" class="font-semibold text-xl tracking-tight text-gray-900">
      LOGO
    </a>
    <div class="hidden md:flex gap-6 text-sm text-gray-700">
      <a href="#" class="hover:text-blue-600 transition-colors duration-200">导航1</a>
      <a href="#" class="hover:text-blue-600 transition-colors duration-200">导航2</a>
      <a href="#" class="hover:text-blue-600 transition-colors duration-200">导航3</a>
    </div>
  </div>
</nav>
```

### 5.5 弹窗 / Modal

```html
<!-- 遮罩层 -->
<div class="
  fixed inset-0 z-[100]
  bg-black/20
  backdrop-blur-sm
  flex items-center justify-center
  p-4
">
  <!-- 玻璃弹窗 -->
  <div class="
    w-full max-w-md
    bg-white/70
    rounded-2xl
    border border-white/40
    backdrop-blur-2xl
    shadow-[0_16px_48px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.5)]
    p-6 md:p-8
  ">
    <h2 class="font-semibold tracking-tight text-xl md:text-2xl text-gray-900 mb-4">
      弹窗标题
    </h2>
    <p class="text-sm md:text-base text-gray-700 mb-6 leading-relaxed">
      弹窗内容，玻璃质感让弹窗与背景自然融合，同时保持内容可读性。
    </p>
    <div class="flex justify-end gap-3">
      <button class="px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:bg-gray-100 text-gray-700">
        取消
      </button>
      <button class="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white transition-all duration-200 hover:bg-blue-700 active:scale-[0.98]">
        确认
      </button>
    </div>
  </div>
</div>
```

---

## 6. 页面骨架模板

### 6.1 带玻璃 Hero 的企业首页

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>企业首页 | Corporate Liquid Glass</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* 玻璃工具类 */
    .glass { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35); backdrop-filter: blur(12px) saturate(1.2); }
    .glass-hover:hover { background: rgba(255,255,255,0.25); backdrop-filter: blur(16px) saturate(1.3); }
    .glass-shadow { box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.4); }
    .glass-nav { background: rgba(255,255,255,0.6); backdrop-filter: blur(20px) saturate(1.5); border-bottom: 1px solid rgba(255,255,255,0.3); }
  </style>
</head>
<body class="bg-gray-50 text-gray-900 antialiased">

  <!-- ===== 玻璃导航栏 ===== -->
  <nav class="sticky top-0 z-50 glass-nav px-4 md:px-8 py-3 md:py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.5)]">
    <div class="flex items-center justify-between max-w-6xl mx-auto">
      <a href="/" class="font-semibold text-xl tracking-tight">{LOGO}</a>
      <div class="hidden md:flex gap-6 text-sm text-gray-700">
        {NAV_LINKS}
      </div>
      <button class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm transition-all duration-200 hover:bg-blue-700 active:scale-[0.98]">
        开始使用
      </button>
    </div>
  </nav>

  <!-- ===== Hero 区块 ===== -->
  <section class="relative min-h-[80vh] flex items-center overflow-hidden">
    <!-- 背景渐变 -->
    <div class="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50"></div>
    <!-- 背景装饰圆 -->
    <div class="absolute top-20 right-10 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl"></div>
    <div class="absolute bottom-10 left-10 w-72 h-72 bg-indigo-200/25 rounded-full blur-3xl"></div>

    <!-- 内容 -->
    <div class="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-20 text-center">
      <h1 class="font-bold tracking-tight text-4xl md:text-5xl lg:text-6xl text-gray-900 mb-6">
        {HEADLINE}
      </h1>
      <p class="text-base md:text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
        {SUBHEADLINE}
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button class="px-6 py-3 md:px-8 md:py-4 bg-blue-600 text-white rounded-lg font-medium transition-all duration-200 hover:bg-blue-700 hover:-translate-y-0.5 active:scale-[0.98] focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
          {CTA_PRIMARY}
        </button>
        <button class="glass glass-shadow px-6 py-3 md:px-8 md:py-4 rounded-lg font-medium text-gray-700 transition-all duration-300 hover:-translate-y-0.5 glass-hover">
          {CTA_SECONDARY}
        </button>
      </div>
    </div>
  </section>

  <!-- ===== 玻璃卡片网格 ===== -->
  <section class="py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8">
    <div class="max-w-6xl mx-auto">
      <h2 class="font-semibold tracking-tight text-2xl md:text-3xl text-gray-900 mb-8 md:mb-12 text-center">
        {SECTION_TITLE}
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- 玻璃卡片模板 -->
        <div class="glass glass-shadow rounded-[20px] p-6 transition-all duration-300 hover:-translate-y-1 glass-hover">
          <h3 class="font-semibold tracking-tight text-xl md:text-2xl text-gray-900 mb-2">{CARD_TITLE}</h3>
          <p class="text-sm md:text-base text-gray-700 leading-relaxed">{CARD_DESCRIPTION}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== 标准卡片网格（混合使用） ===== -->
  <section class="py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8 bg-white">
    <div class="max-w-6xl mx-auto">
      <h2 class="font-semibold tracking-tight text-2xl md:text-3xl text-gray-900 mb-8 md:mb-12 text-center">
        {SECTION_TITLE_2}
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- 标准卡片（数据/信息密集型） -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <h3 class="font-semibold tracking-tight text-lg md:text-xl text-gray-900 mb-2">{CARD_TITLE}</h3>
          <p class="text-sm md:text-base text-gray-700 leading-relaxed">{CARD_DESCRIPTION}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== 页脚 ===== -->
  <footer class="bg-gray-900 text-white py-12 md:py-16 px-4 md:px-8">
    <div class="max-w-6xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <span class="font-semibold text-xl tracking-tight">{LOGO}</span>
          <p class="text-sm mt-4 text-gray-400">{TAGLINE}</p>
        </div>
        <div>
          <h4 class="font-semibold text-lg mb-4">{COLUMN_TITLE}</h4>
          <ul class="space-y-2 text-sm text-gray-400">
            {FOOTER_LINKS}
          </ul>
        </div>
      </div>
      <div class="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-500">
        {COPYRIGHT}
      </div>
    </div>
  </footer>

</body>
</html>
```

### 6.2 玻璃仪表板布局

```html
<div class="min-h-screen bg-gray-50">
  <!-- 玻璃顶部导航 -->
  <header class="glass-nav sticky top-0 z-50 px-6 py-3 border-b border-white/30 flex items-center justify-between">
    <h1 class="font-semibold text-lg tracking-tight">Dashboard</h1>
    <div class="flex items-center gap-4">
      <input class="px-3 py-1.5 bg-white/40 border border-white/30 rounded-lg text-sm backdrop-blur-sm focus:ring-2 focus:ring-blue-500/60" placeholder="搜索..." />
      <div class="w-8 h-8 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">U</div>
    </div>
  </header>

  <div class="flex">
    <!-- 玻璃侧边栏 -->
    <aside class="w-64 min-h-[calc(100vh-57px)] glass-nav border-r border-white/30 p-4 hidden md:block">
      <nav class="space-y-1">
        <a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600/15 text-blue-700">概览</a>
        <a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-white/30 transition-colors">分析</a>
        <a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-white/30 transition-colors">用户</a>
        <a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-white/30 transition-colors">设置</a>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="flex-1 p-6">
      <!-- KPI 指标卡（标准卡片：数据密集，不用玻璃） -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p class="text-xs text-gray-500 mb-1">总用户数</p>
          <p class="text-2xl font-semibold tracking-tight text-gray-900">24,521</p>
          <p class="text-xs text-green-600 mt-1">↑ 12.5%</p>
        </div>
        <!-- 更多 KPI 卡片... -->
      </div>

      <!-- 图表区（玻璃面板） -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="glass glass-shadow rounded-[20px] p-6">
          <h3 class="font-semibold tracking-tight text-lg mb-4">趋势图</h3>
          <div class="h-64 flex items-center justify-center text-gray-400 text-sm">{CHART_PLACEHOLDER}</div>
        </div>
        <div class="glass glass-shadow rounded-[20px] p-6">
          <h3 class="font-semibold tracking-tight text-lg mb-4">分布图</h3>
          <div class="h-64 flex items-center justify-center text-gray-400 text-sm">{CHART_PLACEHOLDER}</div>
        </div>
      </div>
    </main>
  </div>
</div>
```

---

## 7. CSS 工具类扩展

### 7.1 完整玻璃工具类（Tailwind 兼容，也可独立使用）

```css
/* ============================================================
   Corporate Liquid Glass — CSS Utility Classes
   可配合 Tailwind 使用，也可独立引入
   ============================================================ */

/* --- 基础玻璃 --- */
.glass {
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(12px) saturate(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.glass:hover {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
}

/* --- 玻璃强度变体 --- */
.glass-subtle  { background: rgba(255,255,255, 0.08); backdrop-filter: blur(6px); }
.glass-light   { background: rgba(255,255,255, 0.12); backdrop-filter: blur(10px); }
.glass-medium  { background: rgba(255,255,255, 0.22); backdrop-filter: blur(16px); }
.glass-heavy   { background: rgba(255,255,255, 0.28); backdrop-filter: blur(20px); }

/* --- 深色玻璃 --- */
.glass-dark       { background: rgba(0,0,0,0.12); border-color: rgba(255,255,255,0.12); color: #fff; }
.glass-dark:hover { background: rgba(0,0,0,0.18); }

/* --- 玻璃圆角 --- */
.glass-rounded-sm   { border-radius: 12px; }
.glass-rounded-md   { border-radius: 16px; }
.glass-rounded-lg   { border-radius: 20px; }
.glass-rounded-xl   { border-radius: 24px; }
.glass-rounded-2xl  { border-radius: 32px; }
.glass-rounded-full { border-radius: 9999px; }

/* --- 玻璃阴影 --- */
.glass-shadow-sm {
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04),
              inset 0 1px 1px rgba(255,255,255,0.4);
}
.glass-shadow {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04),
              inset 0 1px 1px rgba(255,255,255,0.4);
}
.glass-shadow-lg {
  box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 3px 8px rgba(0,0,0,0.05),
              inset 0 1px 1px rgba(255,255,255,0.3);
}
.glass-shadow-xl {
  box-shadow: 0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06),
              inset 0 1px 1px rgba(255,255,255,0.25);
}

/* --- 玻璃卡片（组合类） --- */
.glass-card {
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 20px;
  padding: 1.5rem;
  backdrop-filter: blur(12px) saturate(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04),
              inset 0 1px 1px rgba(255,255,255,0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.glass-card:hover {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.10), 0 3px 8px rgba(0,0,0,0.05),
              inset 0 1px 1px rgba(255,255,255,0.35);
}

/* --- 玻璃导航栏 --- */
.glass-nav {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.5);
}

/* --- 玻璃输入框 --- */
.glass-input {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.30);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: all 0.3s ease;
  outline: none;
}
.glass-input:focus {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(59, 130, 246, 0.6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

/* --- 玻璃按钮 --- */
.glass-btn {
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-weight: 500;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
.glass-btn:hover {
  background: rgba(255, 255, 255, 0.30);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.10), inset 0 1px 1px rgba(255,255,255,0.35);
}
.glass-btn:active {
  transform: scale(0.98);
}

/* --- Liquid Glass（SVG 滤镜增强版） --- */
.glass-liquid {
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 16px;
  backdrop-filter: url(#liquid-glass-filter) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1);
  box-shadow: 0 4px 12px rgba(0,0,0,0.10),
              inset 0 -10px 25px rgba(0,0,0,0.06),
              inset 0 1px 1px rgba(255,255,255,0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.glass-liquid:hover {
  background: rgba(255, 255, 255, 0.25);
  box-shadow: 0 8px 32px rgba(0,0,0,0.14),
              inset 0 -10px 25px rgba(0,0,0,0.10),
              inset 0 1px 1px rgba(255,255,255,0.35);
}

/* --- 降级方案：不支持 backdrop-filter 时 --- */
@supports not (backdrop-filter: blur(1px)) {
  .glass,
  .glass-card,
  .glass-nav,
  .glass-input,
  .glass-btn,
  .glass-liquid {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .glass-dark {
    background: rgba(0, 0, 0, 0.7);
  }
}

/* --- 动效降级：尊重用户偏好 --- */
@media (prefers-reduced-motion: reduce) {
  .glass,
  .glass-card,
  .glass-btn,
  .glass-liquid,
  .glass-input {
    transition-duration: 0.01ms !important;
  }
  .glass-card:hover,
  .glass-btn:hover {
    transform: none;
  }
}
```

---

## 8. React 组件实现

### 8.1 LiquidGlass 核心组件

```tsx
// components/LiquidGlass.tsx
import React, { useRef, useEffect, useCallback, useMemo } from 'react'

interface MousePosition {
  x: number
  y: number
}

interface FragmentUV {
  x: number
  y: number
}

interface FragmentResult {
  type: 't'
  x: number
  y: number
}

type FragmentFunction = (uv: FragmentUV, mouse?: MousePosition) => FragmentResult

interface LiquidGlassProps {
  /** 玻璃宽度 (px) */
  width?: number
  /** 玻璃高度 (px) */
  height?: number
  /** 自定义像素扭曲函数 */
  fragment?: FragmentFunction
  /** 圆角大小 (px) */
  borderRadius?: number
  /** 玻璃透明度 */
  opacity?: number
  /** 是否可拖拽 */
  draggable?: boolean
  /** 附加 CSS 类名 */
  className?: string
  /** 内联样式 */
  style?: React.CSSProperties
  /** 子内容（玻璃内部显示的元素） */
  children?: React.ReactNode
}

// --- 工具函数 ---
function smoothStep(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

function roundedRectSDF(
  x: number, y: number,
  width: number, height: number,
  radius: number
): number {
  const qx = Math.abs(x) - width + radius
  const qy = Math.abs(y) - height + radius
  return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius
}

function texture(x: number, y: number): FragmentResult {
  return { type: 't', x, y }
}

let idCounter = 0
function generateId(): string {
  return `liquid-glass-${++idCounter}-${Math.random().toString(36).substr(2, 6)}`
}

// --- 组件 ---
export const LiquidGlass: React.FC<LiquidGlassProps> = ({
  width = 300,
  height = 200,
  fragment,
  borderRadius = 150,
  opacity = 1,
  draggable = true,
  className = '',
  style = {},
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const feImageRef = useRef<SVGFEImageElement>(null)
  const feDisplacementMapRef = useRef<SVGFEDisplacementMapElement>(null)

  const mouseRef = useRef<MousePosition>({ x: 0, y: 0 })
  const mouseUsedRef = useRef(false)
  const isDraggingRef = useRef(false)
  const dragDataRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 })

  const canvasDPI = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const offset = 10

  const id = useMemo(() => generateId(), [])

  // 默认扭曲函数
  const defaultFragment: FragmentFunction = useCallback((uv: FragmentUV): FragmentResult => {
    const ix = uv.x - 0.5
    const iy = uv.y - 0.5
    const distanceToEdge = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6)
    const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15)
    const scaled = smoothStep(0, 1, displacement)
    return texture(ix * scaled + 0.5, iy * scaled + 0.5)
  }, [])

  const fragmentShader = fragment || defaultFragment

  // 约束位置在视口内
  const constrainPosition = useCallback((x: number, y: number) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    return {
      x: Math.max(offset, Math.min(vw - width - offset, x)),
      y: Math.max(offset, Math.min(vh - height - offset, y)),
    }
  }, [width, height])

  // 更新位移贴图
  const updateShader = useCallback(() => {
    const canvas = canvasRef.current
    const feImage = feImageRef.current
    const feDisplacementMap = feDisplacementMapRef.current
    if (!canvas || !feImage || !feDisplacementMap) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Proxy 检测 mouse 是否被 fragment 使用
    const mouseProxy = new Proxy(mouseRef.current, {
      get: (target, prop) => {
        mouseUsedRef.current = true
        return target[prop as keyof MousePosition]
      },
    })
    mouseUsedRef.current = false

    const w = width * canvasDPI
    const h = height * canvasDPI
    const data = new Uint8ClampedArray(w * h * 4)
    const rawValues: number[] = []
    let maxScale = 0

    // 第一遍：计算像素位移
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % w
      const y = Math.floor(i / 4 / w)
      const pos = fragmentShader({ x: x / w, y: y / h }, mouseProxy)
      const dx = pos.x * w - x
      const dy = pos.y * h - y
      maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy))
      rawValues.push(dx, dy)
    }

    maxScale *= 0.5

    // 第二遍：编码为颜色
    let index = 0
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = Math.round(((rawValues[index++] / maxScale) + 0.5) * 255)  // R
      data[i + 1] = Math.round(((rawValues[index++] / maxScale) + 0.5) * 255)  // G
      data[i + 2] = 0   // B 未使用
      data[i + 3] = 255 // A 不透明
    }

    ctx.putImageData(new ImageData(data, w, h), 0, 0)
    feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL())
    feDisplacementMap.setAttribute('scale', String(maxScale / canvasDPI))
  }, [width, height, canvasDPI, fragmentShader])

  // --- 拖拽事件 ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!draggable) return
    isDraggingRef.current = true
    const container = containerRef.current
    if (!container) return
    container.style.cursor = 'grabbing'
    dragDataRef.current = {
      startX: e.clientX, startY: e.clientY,
      initialX: container.getBoundingClientRect().left,
      initialY: container.getBoundingClientRect().top,
    }
    e.preventDefault()
  }, [draggable])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return

      if (isDraggingRef.current && draggable) {
        const dx = e.clientX - dragDataRef.current.startX
        const dy = e.clientY - dragDataRef.current.startY
        const constrained = constrainPosition(
          dragDataRef.current.initialX + dx,
          dragDataRef.current.initialY + dy
        )
        container.style.left = `${constrained.x}px`
        container.style.top = `${constrained.y}px`
        container.style.transform = 'none'
      }

      const rect = container.getBoundingClientRect()
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      }
      if (mouseUsedRef.current) updateShader()
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      if (containerRef.current) containerRef.current.style.cursor = draggable ? 'grab' : 'default'
    }

    const handleResize = () => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const constrained = constrainPosition(rect.left, rect.top)
      if (rect.left !== constrained.x || rect.top !== constrained.y) {
        container.style.left = `${constrained.x}px`
        container.style.top = `${constrained.y}px`
        container.style.transform = 'none'
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('resize', handleResize)
    }
  }, [draggable, constrainPosition, updateShader])

  useEffect(() => { updateShader() }, [updateShader])

  // --- 样式 ---
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width, height,
    overflow: 'hidden',
    borderRadius,
    opacity,
    cursor: draggable ? 'grab' : 'default',
    backdropFilter: `url(#${id}_filter) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1)`,
    WebkitBackdropFilter: `url(#${id}_filter) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1)`,
    boxShadow: '0 4px 8px rgba(0,0,0,0.25), 0 -10px 25px inset rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.2)',
    zIndex: 9999,
    pointerEvents: 'auto',
    ...style,
  }

  return (
    <>
      {/* SVG 滤镜定义（隐藏） */}
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9998, width: 0, height: 0 }}
      >
        <defs>
          <filter
            id={`${id}_filter`}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
            x="0" y="0" width={String(width)} height={String(height)}
          >
            <feImage
              ref={feImageRef}
              id={`${id}_map`}
              width={String(width)} height={String(height)}
            />
            <feDisplacementMap
              ref={feDisplacementMapRef}
              in="SourceGraphic"
              in2={`${id}_map`}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* 液体玻璃容器 */}
      <div
        ref={containerRef}
        className={className}
        style={containerStyle}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>

      {/* 隐藏 Canvas（生成位移贴图） */}
      <canvas
        ref={canvasRef}
        width={width * canvasDPI}
        height={height * canvasDPI}
        style={{ display: 'none' }}
      />
    </>
  )
}

export default LiquidGlass
```

### 8.2 GlassCard 组件

```tsx
// components/GlassCard.tsx
import React from 'react'

interface GlassCardProps {
  /** 玻璃强度: 'subtle' | 'light' | 'default' | 'medium' | 'heavy' */
  intensity?: 'subtle' | 'light' | 'default' | 'medium' | 'heavy'
  /** 是否启用 liquid glass 扭曲效果 */
  liquid?: boolean
  /** 是否使用深色玻璃 */
  dark?: boolean
  /** 圆角大小 */
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** 阴影大小 */
  shadow?: 'sm' | 'md' | 'lg' | 'xl'
  /** 内边距 */
  padding?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  onClick?: () => void
}

const intensityMap = {
  subtle: 'bg-white/8 backdrop-blur-[6px]',
  light: 'bg-white/12 backdrop-blur-[10px]',
  default: 'bg-white/18 backdrop-blur-[12px]',
  medium: 'bg-white/22 backdrop-blur-[16px]',
  heavy: 'bg-white/28 backdrop-blur-[20px]',
}

const roundedMap = { sm: '12px', md: '16px', lg: '20px', xl: '24px', '2xl': '32px' }
const paddingMap = { sm: 'p-4 md:p-5', md: 'p-6', lg: 'p-8 md:p-10' }

export const GlassCard: React.FC<GlassCardProps> = ({
  intensity = 'default',
  liquid = false,
  dark = false,
  rounded = 'lg',
  shadow = 'md',
  padding = 'md',
  className = '',
  style,
  children,
  onClick,
}) => {
  const baseClass = liquid ? 'glass-liquid' : dark ? 'glass-dark' : 'glass'
  const intensityClass = liquid || dark ? '' : intensityMap[intensity]

  const shadowStyles: Record<string, string> = {
    sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.4)',
    md: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04), inset 0 1px 1px rgba(255,255,255,0.4)',
    lg: '0 8px 32px rgba(0,0,0,0.10), 0 3px 8px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.3)',
    xl: '0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.25)',
  }

  return (
    <div
      className={`${baseClass} ${intensityClass} ${paddingMap[padding]} ${className}`}
      style={{
        borderRadius: roundedMap[rounded],
        border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.35)',
        boxShadow: shadowStyles[shadow],
        color: dark ? '#fff' : undefined,
        cursor: onClick ? 'pointer' : undefined,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export default GlassCard
```

---

## 9. Vue 组件实现

### 9.1 LiquidGlass 组件（Vue 3 Composition API）

```vue
<!-- components/LiquidGlass.vue -->
<template>
  <div
    ref="containerRef"
    :class="className"
    :style="containerStyle"
    @mousedown="handleMouseDown"
  >
    <slot />
  </div>

  <!-- SVG 滤镜 -->
  <svg
    ref="svgRef"
    xmlns="http://www.w3.org/2000/svg"
    :style="svgStyle"
  >
    <defs>
      <filter
        :id="`${id}_filter`"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
        x="0" y="0"
        :width="width" :height="height"
      >
        <feImage ref="feImageRef" :id="`${id}_map`" :width="width" :height="height" />
        <feDisplacementMap
          ref="feDisplacementMapRef"
          in="SourceGraphic"
          :in2="`${id}_map`"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  </svg>

  <!-- 隐藏 Canvas -->
  <canvas ref="canvasRef" :width="width * dpi" :height="height * dpi" style="display:none" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

interface MousePosition { x: number; y: number }

const props = withDefaults(defineProps<{
  width?: number
  height?: number
  borderRadius?: number
  draggable?: boolean
  className?: string
}>(), {
  width: 300,
  height: 200,
  borderRadius: 150,
  draggable: true,
  className: '',
})

// Refs
const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const svgRef = ref<SVGSVGElement>()
const feImageRef = ref<SVGFEImageElement>()
const feDisplacementMapRef = ref<SVGFEDisplacementMapElement>()

const id = `liquid-glass-${Math.random().toString(36).substr(2, 9)}`
const dpi = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
const offset = 10

const mouse = ref<MousePosition>({ x: 0, y: 0 })
const isDragging = ref(false)
const dragData = ref({ startX: 0, startY: 0, initialX: 0, initialY: 0 })

// 数学工具
function smoothStep(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
function len(x: number, y: number) { return Math.sqrt(x * x + y * y) }
function roundedRectSDF(x: number, y: number, w: number, h: number, r: number) {
  const qx = Math.abs(x) - w + r
  const qy = Math.abs(y) - h + r
  return Math.min(Math.max(qx, qy), 0) + len(Math.max(qx, 0), Math.max(qy, 0)) - r
}

function defaultFragment(uv: { x: number; y: number }) {
  const ix = uv.x - 0.5
  const iy = uv.y - 0.5
  const d = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6)
  const displacement = smoothStep(0.8, 0, d - 0.15)
  const scaled = smoothStep(0, 1, displacement)
  return { type: 't' as const, x: ix * scaled + 0.5, y: iy * scaled + 0.5 }
}

function updateShader() {
  const canvas = canvasRef.value
  const feImage = feImageRef.value
  const feDisplacementMap = feDisplacementMapRef.value
  if (!canvas || !feImage || !feDisplacementMap) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = props.width * dpi
  const h = props.height * dpi
  const data = new Uint8ClampedArray(w * h * 4)
  const rawValues: number[] = []
  let maxScale = 0

  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % w
    const y = Math.floor(i / 4 / w)
    const pos = defaultFragment({ x: x / w, y: y / h })
    const dx = pos.x * w - x
    const dy = pos.y * h - y
    maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy))
    rawValues.push(dx, dy)
  }
  maxScale *= 0.5

  let idx = 0
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = (rawValues[idx++] / maxScale + 0.5) * 255
    data[i + 1] = (rawValues[idx++] / maxScale + 0.5) * 255
    data[i + 2] = 0
    data[i + 3] = 255
  }

  ctx.putImageData(new ImageData(data, w, h), 0, 0)
  feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL())
  feDisplacementMap.setAttribute('scale', String(maxScale / dpi))
}

function constrainPosition(x: number, y: number) {
  return {
    x: Math.max(offset, Math.min(window.innerWidth - props.width - offset, x)),
    y: Math.max(offset, Math.min(window.innerHeight - props.height - offset, y)),
  }
}

function handleMouseDown(e: MouseEvent) {
  if (!props.draggable) return
  isDragging.value = true
  const el = containerRef.value!
  el.style.cursor = 'grabbing'
  dragData.value = { startX: e.clientX, startY: e.clientY, initialX: el.getBoundingClientRect().left, initialY: el.getBoundingClientRect().top }
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  const el = containerRef.value
  if (!el) return
  if (isDragging.value && props.draggable) {
    const dx = e.clientX - dragData.value.startX
    const dy = e.clientY - dragData.value.startY
    const c = constrainPosition(dragData.value.initialX + dx, dragData.value.initialY + dy)
    el.style.left = `${c.x}px`
    el.style.top = `${c.y}px`
    el.style.transform = 'none'
  }
  const rect = el.getBoundingClientRect()
  mouse.value = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
}

function onMouseUp() {
  isDragging.value = false
  if (containerRef.value) containerRef.value.style.cursor = props.draggable ? 'grab' : 'default'
}

function onResize() {
  const el = containerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const c = constrainPosition(rect.left, rect.top)
  if (rect.left !== c.x || rect.top !== c.y) {
    el.style.left = `${c.x}px`
    el.style.top = `${c.y}px`
    el.style.transform = 'none'
  }
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  window.addEventListener('resize', onResize)
  updateShader()
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('resize', onResize)
})

const containerStyle = computed(() => ({
  position: 'fixed' as const,
  top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  width: `${props.width}px`, height: `${props.height}px`,
  overflow: 'hidden',
  borderRadius: `${props.borderRadius}px`,
  cursor: props.draggable ? 'grab' : 'default',
  backdropFilter: `url(#${id}_filter) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1)`,
  WebkitBackdropFilter: `url(#${id}_filter) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1)`,
  boxShadow: '0 4px 8px rgba(0,0,0,0.25), 0 -10px 25px inset rgba(0,0,0,0.15)',
  border: '1px solid rgba(255,255,255,0.2)',
  zIndex: 9999,
  pointerEvents: 'auto' as const,
}))

const svgStyle = {
  position: 'fixed' as const, top: 0, left: 0,
  pointerEvents: 'none' as const, zIndex: 9998, width: 0, height: 0,
}
</script>
```

---

## 10. 原生 HTML/CSS 实现

### 10.1 纯 CSS 玻璃卡片（无需 JS）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>纯 CSS 玻璃卡片</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      /* 丰富的渐变背景，展示玻璃效果 */
      background:
        linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
      color: #1a1a2e;
    }

    /* 背景装饰球（让玻璃扭曲效果有内容可扭曲） */
    .bg-decoration {
      position: fixed;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.5;
      pointer-events: none;
    }
    .bg-decoration-1 {
      width: 400px; height: 400px;
      background: #ff6b6b;
      top: -100px; left: -100px;
    }
    .bg-decoration-2 {
      width: 300px; height: 300px;
      background: #4ecdc4;
      bottom: -50px; right: -50px;
    }
    .bg-decoration-3 {
      width: 250px; height: 250px;
      background: #ffe66d;
      top: 50%; left: 60%;
    }

    /* --- 玻璃卡片 --- */
    .glass-card {
      position: relative;
      z-index: 1;
      max-width: 400px;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 20px;
      backdrop-filter: blur(12px) saturate(1.2);
      -webkit-backdrop-filter: blur(12px) saturate(1.2);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.10),
        0 3px 8px rgba(0, 0, 0, 0.05),
        inset 0 1px 1px rgba(255, 255, 255, 0.4);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .glass-card:hover {
      background: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(16px) saturate(1.3);
      -webkit-backdrop-filter: blur(16px) saturate(1.3);
      transform: translateY(-4px);
      box-shadow:
        0 16px 48px rgba(0, 0, 0, 0.14),
        0 4px 12px rgba(0, 0, 0, 0.08),
        inset 0 1px 1px rgba(255, 255, 255, 0.35);
    }

    .glass-card h2 {
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-bottom: 0.75rem;
      color: rgba(0, 0, 0, 0.85);
    }

    .glass-card p {
      font-size: 0.95rem;
      line-height: 1.6;
      color: rgba(0, 0, 0, 0.65);
      margin-bottom: 1.5rem;
    }

    /* 玻璃按钮 */
    .glass-btn {
      display: inline-block;
      padding: 0.6rem 1.5rem;
      background: rgba(255, 255, 255, 0.22);
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.4);
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
    }

    .glass-btn:hover {
      background: rgba(255, 255, 255, 0.35);
      box-shadow: 0 4px 16px rgba(0,0,0,0.10), inset 0 1px 1px rgba(255,255,255,0.35);
      transform: translateY(-1px);
    }

    .glass-btn:active {
      transform: scale(0.97);
    }

    /* 降级方案：不支持 backdrop-filter */
    @supports not (backdrop-filter: blur(1px)) {
      .glass-card { background: rgba(255, 255, 255, 0.85); }
      .glass-btn  { background: rgba(255, 255, 255, 0.6); }
    }

    @media (prefers-reduced-motion: reduce) {
      .glass-card, .glass-btn { transition-duration: 0.01ms !important; }
      .glass-card:hover { transform: none; }
    }
  </style>
</head>
<body>
  <div class="bg-decoration bg-decoration-1"></div>
  <div class="bg-decoration bg-decoration-2"></div>
  <div class="bg-decoration bg-decoration-3"></div>

  <div class="glass-card">
    <h2>液体玻璃卡片</h2>
    <p>
      这是一张纯 CSS 实现的玻璃拟态卡片。背景的渐变色彩透过半透明玻璃呈现，
      配合模糊与饱和度增强，营造出真实玻璃的质感。
    </p>
    <a href="#" class="glass-btn">了解更多 →</a>
  </div>
</body>
</html>
```

---

## 11. 禁止项与自检清单

### 11.1 [FORBIDDEN] 绝对禁止

#### 禁止的 CSS Class / 模式

| 禁止项 | 原因 | 替代方案 |
|--------|------|---------|
| `rounded-none` | 企业风需要一定圆角 | `rounded-lg` 或 `rounded-xl` |
| `shadow-2xl` | 阴影应克制（企业层） | `shadow-md` 或 `glass-shadow-lg` |
| `bg-gradient-to-r` / `bg-gradient-*` | 企业层禁用渐变背景 | 纯色 `bg-{color}` |
| `text-neon` / 荧光色文字 | 破坏专业感 | 使用色阶体系内颜色 |
| `border-4` / `border-8` | 粗边框显得粗糙 | `border` (1px) |
| `backdrop-blur-3xl` + 非玻璃场景 | 过度模糊降低可读性 | `backdrop-blur-md` |
| 玻璃效果用于表格/列表 | 严重降低数据可读性 | 标准白色背景卡片 |
| 单页超过 5 个 Liquid Glass 元素 | 性能下降、视觉过载 | 精选关键视觉节点 |
| `duration-500` 以上动效 | 企业 UI 要利落 | `duration-200` (标准) / `duration-300` (玻璃) |
| 缺少 `focus:ring-offset-2` | WCAG 无障碍不达标 | 始终配 `focus:ring-offset-2` |
| 按钮缺少 `active:scale-[0.98]` | 无按压反馈 | 始终加 `active:scale-[0.98]` |
| 在彩色背景上放灰色文字 | 对比度不足 | 使用白色或深色文字 |
| 渐变文字 (`background-clip: text`) | 花哨不专业 | 纯色文字 |
| 单侧粗边框装饰 (`border-l-4`) | 风格冲突 | 统一边框或阴影区分 |
| 使用 Inter / Roboto / Geist 字体 | 过度使用 | `system-ui` 系统字体栈 |

#### 禁止的模式（正则匹配）

```
^shadow-2xl$
^bg-gradient-
^border-[48]$
^text-neon
^backdrop-blur-3xl (?=.*table|.*list|.*data)
```

### 11.2 [REQUIRED] 必须包含

#### 标准按钮
```
px-4 py-2 md:px-6 md:py-3
rounded-lg
font-medium
transition-all duration-200
active:scale-[0.98]
focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
```

#### 标准卡片
```
bg-white
rounded-xl
shadow-sm
border border-gray-200
p-6
```

#### 玻璃卡片（增强）
```
bg-white/18
border border-white/35
backdrop-blur-md
rounded-[20px]
shadow-[玻璃阴影]
```

#### 输入框
```
px-3 py-2 md:px-4 md:py-3
border border-gray-300
rounded-lg
focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500
```

### 11.3 [CHECKLIST] 生成后自检清单

**在输出代码前，必须逐项验证以下每一条。如有违反，立即修正后再输出：**

#### 1. 企业基础层检查
- [ ] 颜色使用色阶体系内颜色，无荧光/霓虹色
- [ ] 无渐变背景（`bg-gradient-*`）
- [ ] 圆角在 `rounded-lg` ~ `rounded-2xl` 范围内
- [ ] 阴影为 `shadow-sm` / `shadow` / `shadow-md`
- [ ] 标题使用 `font-semibold tracking-tight`
- [ ] 所有交互元素有 `transition-all duration-200`
- [ ] 所有按钮有 `active:scale-[0.98]`
- [ ] 所有 focus 有 `ring-offset-2`
- [ ] 正文行宽不超过 65-75 字符
- [ ] 正文对比度满足 WCAG AA (≥4.5:1)

#### 2. 液体玻璃层检查
- [ ] 玻璃元素有 `backdrop-filter: blur()` + `saturate()`
- [ ] 玻璃元素有内阴影 (`inset 0 1px 1px rgba(255,255,255,...)`)
- [ ] 玻璃背景透明度在 8%~28% 范围内
- [ ] 玻璃边框透明度在 12%~35% 范围内
- [ ] glass-liquid 元素数量 ≤ 5 个/页
- [ ] 玻璃不用在数据表格、密集列表上
- [ ] 有 `@supports not (backdrop-filter)` 降级方案

#### 3. 响应式检查
- [ ] 字号有响应式值（`text-sm md:text-base`）
- [ ] 间距有响应式值（`p-4 md:p-6`）
- [ ] 卡片网格有响应式列数（`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`）

#### 4. 动效与无障碍检查
- [ ] 动效 duration ≤ 300ms（玻璃元素）/ ≤ 200ms（标准元素）
- [ ] 有 `prefers-reduced-motion` 降级
- [ ] 所有交互元素可键盘访问
- [ ] 无 bounce / elastic 缓动曲线

#### 5. 性能检查
- [ ] Liquid Glass 位移贴图尺寸 ≤ 300×200
- [ ] Canvas DPI 缩放正确（`devicePixelRatio`）
- [ ] 隐藏 Canvas 已设置 `display: none`
- [ ] SVG 滤镜尺寸匹配玻璃元素尺寸

---

## 12. 示例 Prompt 模板

### 12.1 企业 SaaS 落地页

```
使用 Corporate Liquid Glass 设计系统生成企业 SaaS 落地页：

页面结构：
1. 玻璃导航栏（sticky，滚动后背景增强）
2. Hero 区域：大标题 + 副标题 + CTA 按钮组 + 背景装饰球
3. 功能卡片区（3列网格，玻璃卡片带 hover 位移）
4. 客户案例区（标准企业卡片，数据为重不搞玻璃）
5. 定价表（标准白色卡片，hover 微上移）
6. 页脚（深色标准）

设计要求：
- 颜色：主色 blue-600，背景 gray-50
- 标题：font-semibold tracking-tight
- 按钮：transition-all duration-200 active:scale-[0.98] focus:ring-offset-2
- 玻璃卡片：bg-white/18 backdrop-blur-md border-white/35 rounded-[20px]
- 标准卡片：bg-white rounded-xl shadow-sm border-gray-200
- 玻璃元素不超过 4 个
- 必须有 prefers-reduced-motion 降级
- 必须有 backdrop-filter 降级方案
```

### 12.2 企业后台仪表板

```
使用 Corporate Liquid Glass 设计系统生成企业后台仪表板：

页面结构：
1. 玻璃顶部导航（搜索框 + 用户头像）
2. 玻璃侧边栏（导航链接 + 当前高亮）
3. 主内容区：
   - KPI 指标卡行（标准白色卡片，数据密集）
   - 图表面板（玻璃面板，2列网格）
   - 数据表格（标准白色背景，无玻璃）

设计要求：
- 颜色：主色 blue-600，侧边栏宽 256px
- 数据卡片：白色背景，数值大字，百分比趋势色
- 玻璃面板：bg-white/18 backdrop-blur-md
- 表格：标准白色，hover row 高亮 bg-gray-50
- 所有输入框：focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
- 玻璃元素不超过 4 个（nav + sidebar + 2 chart panels）
```

### 12.3 企业登录页

```
使用 Corporate Liquid Glass 设计系统生成企业登录页面：

页面结构：
1. 全屏渐变背景（blue-50 → indigo-50）+ 装饰球
2. 居中玻璃卡片：
   - 公司 Logo 在上
   - 邮箱输入框（玻璃样式）
   - 密码输入框（玻璃样式）
   - 主提交按钮（蓝色标准）
   - SSO 登录按钮（幽灵/玻璃样式）
   - "忘记密码" 文字链接
   - 底部隐私政策链接
3. 右侧装饰性 Liquid Glass 球（300×200，可拖拽）

设计要求：
- 卡片宽度 max-w-sm，玻璃质感 bg-white/70 backdrop-blur-2xl
- 输入框：bg-white/40 border-white/30 focus:border-blue-400
- 提交按钮：标准企业蓝 bg-blue-600 hover:bg-blue-700 active:scale-[0.98]
- 无多余装饰，专业、安全、可信
- 动效简洁利落（duration-200）
```

---

## 附录

### A. 浏览器兼容性

| 特性 | Chrome | Safari | Firefox | Edge |
|------|--------|--------|---------|------|
| `backdrop-filter` | ✅ 76+ | ✅ 9+ (webkit) | ✅ 103+ | ✅ 79+ |
| SVG `feDisplacementMap` | ✅ | ✅ | ✅ | ✅ |
| Canvas `putImageData` | ✅ | ✅ | ✅ | ✅ |
| `devicePixelRatio` | ✅ | ✅ | ✅ | ✅ |

> **降级策略**：不支持的浏览器自动降级为半透明纯色背景（通过 `@supports` 检测）。

### B. 性能基准

| 场景 | 帧率 (FPS) | 内存 | 说明 |
|------|-----------|------|------|
| 1 个 Liquid Glass 元素 (300×200) | 58-60 | +2MB | 流畅 |
| 3 个 Liquid Glass 元素 | 55-60 | +5MB | 可接受 |
| 5 个 Liquid Glass 元素 | 48-55 | +8MB | 上限，移动端降至 40-50 FPS |
| 标准玻璃卡片（仅 CSS） | 60 | 忽略 | 无性能影响 |
| 标准企业卡片 | 60 | 忽略 | 基准 |

### C. 相关资源

- **Liquid Glass 在线演示**: [https://eloquent-beijinho-4a6d83.netlify.app/](https://eloquent-beijinho-4a6d83.netlify.app/)
- **Liquid Glass 完整代码**: [https://github.com/childrentime/liquid-glass](https://github.com/childrentime/liquid-glass)
- **参考实现**: [https://github.com/shuding/liquid-glass](https://github.com/shuding/liquid-glass)
- **Apple Design Resources**: [https://developer.apple.com/design/](https://developer.apple.com/design/)
- **WCAG 2.1 AA 标准**: [https://www.w3.org/WAI/WCAG2AA-Conformance](https://www.w3.org/WAI/WCAG2AA-Conformance)

---

> **版本**: v1.0 | **更新日期**: 2026-07-20 | **风格标签**: `corporate-liquid-glass`
