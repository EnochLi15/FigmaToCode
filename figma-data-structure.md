# Figma 转换 JSON 数据格式分析

本文档分析了工程中将 Figma 选中节点转换为 JSON 后的数据格式及其含义。该格式基于 Figma REST API 的 JSON 结构，并由 `jsonNodeConversion.ts` 进行了扩展和处理。

## 1. 概述

转换后的 JSON 对象主要包含两部分信息：
1.  **Figma 原生属性**：直接来自 Figma 节点的属性，与 Figma REST API 保持一致（如 `id`, `name`, `type`, `fills` 等）。
2.  **扩展属性**：由转换脚本计算或添加的属性，用于辅助代码生成（如 `uniqueName`, `layoutMode` 的默认值, `styledTextSegments` 等）。

## 2. 通用属性 (Common Properties)

所有类型的节点通常包含以下字段：

| 字段名 | 类型 | 含义 | 备注 |
| :--- | :--- | :--- | :--- |
| `id` | string | 节点在 Figma 中的唯一标识符 | 例如 "1:2" |
| `name` | string | 节点在 Figma 图层面板中的名称 | |
| `uniqueName` | string | **[扩展]** 转换脚本生成的唯一名称 | 用于生成代码中的变量名或类名，处理了重名情况 |
| `type` | string | 节点类型 | 如 "FRAME", "RECTANGLE", "TEXT", "INSTANCE", "VECTOR" 等 |
| `visible` | boolean | 节点是否可见 | 默认为 true |
| `opacity` | number | 透明度 | 0-1 之间 |
| `blendMode` | string | 混合模式 | 如 "PASS_THROUGH", "NORMAL" 等 |
| `isRelative` | boolean | **[扩展]** 是否相对定位 | 用于布局计算，当 layoutMode 为 NONE 或包含绝对定位子节点时为 true |

## 3. 几何与定位 (Geometry & Positioning)

| 字段名 | 类型 | 含义 | 备注 |
| :--- | :--- | :--- | :--- |
| `x` | number | **[处理后]** 节点的 X 坐标 | 经过计算，通常是相对于父节点的坐标 |
| `y` | number | **[处理后]** 节点的 Y 坐标 | 经过计算，通常是相对于父节点的坐标 |
| `width` | number | **[处理后]** 节点的宽度 | |
| `height` | number | **[处理后]** 节点的高度 | |
| `rotation` | number | 旋转角度 | 单位为度，脚本中会进行归一化处理 |
| `cumulativeRotation` | number | **[扩展]** 累积旋转角度 | 包含父级节点的旋转影响 |
| `absoluteBoundingBox` | object | 绝对边界框 | 包含 x, y, width, height (Figma 原生数据) |

## 4. 布局属性 (Layout Properties)

主要对应 Auto Layout 相关的属性：

| 字段名 | 类型 | 含义 | 备注 |
| :--- | :--- | :--- | :--- |
| `layoutMode` | string | 布局模式 | "NONE" (无), "HORIZONTAL" (水平), "VERTICAL" (垂直) |
| `primaryAxisAlignItems` | string | 主轴对齐方式 | "MIN", "CENTER", "MAX", "SPACE_BETWEEN" |
| `counterAxisAlignItems` | string | 交叉轴对齐方式 | "MIN", "CENTER", "MAX", "BASELINE" |
| `layoutSizingHorizontal`| string | 水平尺寸调整 | "FIXED", "HUG", "FILL" |
| `layoutSizingVertical` | string | 垂直尺寸调整 | "FIXED", "HUG", "FILL" |
| `layoutGrow` | number | 布局延展系数 | 0 或 1，对应 flex-grow |
| `itemSpacing` | number | 子元素间距 | gap |
| `paddingLeft` | number | 左内边距 | |
| `paddingRight` | number | 右内边距 | |
| `paddingTop` | number | 上内边距 | |
| `paddingBottom` | number | 下内边距 | |
| `layoutPositioning` | string | 定位方式 | "AUTO" (自动), "ABSOLUTE" (绝对) |

## 5. 视觉属性 (Visual Properties)

| 字段名 | 类型 | 含义 | 备注 |
| :--- | :--- | :--- | :--- |
| `fills` | array | 填充样式列表 | 包含颜色、渐变、图片等信息 |
| `strokes` | array | 描边样式列表 | |
| `strokeWeight` | number | 描边宽度 | |
| `individualStrokeWeights`| object | 独立边框宽度 | 包含 top, bottom, left, right |
| `effects` | array | 效果列表 | 如阴影 (DROP_SHADOW), 模糊 (LAYER_BLUR) 等 |
| `cornerRadius` | number | 圆角半径 | 统一圆角 |
| `rectangleCornerRadii` | array | 独立圆角半径 | [topLeft, topRight, bottomRight, bottomLeft] |
| `colorVariableMappings` | map | **[扩展]** 颜色变量映射 | 用于 SVG 等场景，记录颜色变量的使用情况 |

## 6. 文本属性 (Text Properties)

仅 `TEXT` 类型节点包含：

| 字段名 | 类型 | 含义 | 备注 |
| :--- | :--- | :--- | :--- |
| `characters` | string | 文本内容 | |
| `style` | object | 文本样式 | 包含 fontFamily, fontSize, fontWeight, textAlignHorizontal 等 |
| `styledTextSegments` | array | **[扩展]** 分段文本样式 | 包含每个文本片段的样式信息（如不同颜色的文字），每个片段有 `uniqueId` |
| `textAutoResize` | string | 文本自适应模式 | "NONE", "HEIGHT", "WIDTH_AND_HEIGHT" |

## 7. 特殊处理逻辑

在转换过程中，脚本执行了以下特殊处理：

*   **Group Inlining**: `GROUP` 类型的节点会被“内联”处理，即 Group 节点本身被移除，其子节点被提升到父级，但会保留旋转等变换信息。
*   **Empty Frames**: 没有子节点的 `FRAME`, `INSTANCE`, `COMPONENT` 会被转换为 `RECTANGLE`。
*   **Icon Detection**: 脚本会尝试检测图标 (`isLikelyIcon`)，如果被标记为图标且设置了 `embedVectors`，则 `canBeFlattened` 为 true，可能会被导出为 SVG。
*   **Color Variables**: 会解析 `boundVariables` 中的颜色变量，尝试将其映射为 CSS 变量名或十六进制颜色。

## 8. 示例结构 (简化版)

## 9. 详细结构分析 (Detailed Structure Analysis)

### 9.1 Fills (Paint)

`fills` 和 `strokes` 字段是 `Paint` 对象的数组。`Paint` 对象有三种主要类型：`SOLID` (纯色), `GRADIENT` (渐变), `IMAGE` (图片)。

#### 通用属性 (Base Paint)
所有 Paint 对象都包含：
*   `type`: string - 类型标识 ("SOLID", "GRADIENT_LINEAR", "IMAGE" 等)
*   `visible`: boolean - 是否可见 (默认 true)
*   `opacity`: number - 透明度 (0-1)
*   `blendMode`: string - 混合模式 ("NORMAL", "MULTIPLY", "SCREEN" 等)

#### 纯色 (Solid Paint)
*   `type`: "SOLID"
*   `color`: { r: number, g: number, b: number, a: number } - 颜色值 (0-1)
*   `boundVariables`: { color: { type: "VARIABLE_ALIAS", id: string } } - 绑定的变量
*   `variableColorName`: string - **[扩展]** 解析后的变量名 (如 "primary-500", "#ff0000")

#### 渐变 (Gradient Paint)
*   `type`: "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "GRADIENT_DIAMOND"
*   `gradientHandlePositions`: Vector[] - 渐变控制点位置 (归一化坐标 0-1)
*   `gradientStops`: Array<{ position: number, color: RGBA }> - 渐变色标

#### 图片 (Image Paint)
*   `type`: "IMAGE"
*   `scaleMode`: "FILL" | "FIT" | "TILE" | "STRETCH" - 缩放模式
*   `imageRef`: string - 图片引用 ID (需通过 Figma API 获取实际 URL)
*   `imageTransform`: Transform - 图片变换矩阵
*   `scalingFactor`: number - 缩放因子 (仅 TILE 模式)
*   `rotation`: number - 图片旋转角度

### 9.2 StyledTextSegments

`styledTextSegments` 是 `TEXT` 节点特有的扩展属性，用于描述文本中不同样式的片段。它是通过 `figmaNode.getStyledTextSegments` 获取并处理得到的。

每个片段包含以下字段：

| 字段名 | 类型 | 含义 |
| :--- | :--- | :--- |
| `characters` | string | 片段的文本内容 |
| `start` | number | 片段在完整文本中的起始索引 |
| `end` | number | 片段在完整文本中的结束索引 |
| `uniqueId` | string | **[扩展]** 片段的唯一 ID (如 "label_span_01") |
| `fontName` | object | 字体信息 `{ family: string, style: string }` |
| `fontSize` | number | 字号 |
| `fontWeight` | number | 字重 (100-900) |
| `fills` | Paint[] | 文本填充颜色 (结构同上，支持变量) |
| `lineHeight` | object | 行高 `{ value: number, unit: "PIXELS" | "PERCENT" }` |
| `letterSpacing` | object | 字间距 `{ value: number, unit: "PIXELS" | "PERCENT" }` |
| `textCase` | string | 文本大小写转换 ("ORIGINAL", "UPPER", "LOWER", "TITLE") |
| `textDecoration` | string | 文本修饰 ("NONE", "UNDERLINE", "STRIKETHROUGH") |
| `listOptions` | object | 列表样式 `{ type: "NONE" | "ORDERED" | "UNORDERED" }` |
| `indentation` | number | 缩进值 |
| `hyperlink` | object | 超链接 `{ type: "URL", value: string }` |
| `openTypeFeatures` | object | OpenType 特性开关 |

**注意**: `styledTextSegments` 中的 `fills` 也会经过 `processColorVariables` 处理，因此也包含 `variableColorName` 字段。

### 9.3 示例数据 (Examples)

#### Fills 示例

**Solid Paint (纯色)**
```json
{
  "type": "SOLID",
  "visible": true,
  "opacity": 1,
  "blendMode": "NORMAL",
  "color": {
    "r": 0.2,
    "g": 0.4,
    "b": 0.8,
    "a": 1
  },
  "boundVariables": {
    "color": {
      "type": "VARIABLE_ALIAS",
      "id": "VariableID:1234"
    }
  },
  "variableColorName": "primary-blue"
}
```

**Gradient Paint (线性渐变)**
```json
{
  "type": "GRADIENT_LINEAR",
  "visible": true,
  "opacity": 1,
  "blendMode": "NORMAL",
  "gradientHandlePositions": [
    { "x": 0.5, "y": 0 },
    { "x": 0.5, "y": 1 },
    { "x": 0, "y": 0 }
  ],
  "gradientStops": [
    {
      "position": 0,
      "color": { "r": 1, "g": 1, "b": 1, "a": 1 }
    },
    {
      "position": 1,
      "color": { "r": 0, "g": 0, "b": 0, "a": 1 }
    }
  ]
}
```

#### StyledTextSegments 示例
```json
[
  {
    "characters": "Hello ",
    "start": 0,
    "end": 6,
    "uniqueId": "text_span_01",
    "fontName": {
      "family": "Inter",
      "style": "Regular"
    },
    "fontSize": 16,
    "fontWeight": 400,
    "fills": [
      {
        "type": "SOLID",
        "color": { "r": 0, "g": 0, "b": 0, "a": 1 }
      }
    ],
    "lineHeight": {
      "value": 24,
      "unit": "PIXELS"
    },
    "letterSpacing": {
      "value": 0,
      "unit": "PIXELS"
    }
  },
  {
    "characters": "World",
    "start": 6,
    "end": 11,
    "uniqueId": "text_span_02",
    "fontName": {
      "family": "Inter",
      "style": "Bold"
    },
    "fontSize": 16,
    "fontWeight": 700,
    "fills": [
      {
        "type": "SOLID",
        "color": { "r": 0.2, "g": 0.4, "b": 0.8, "a": 1 },
        "variableColorName": "primary-blue"
      }
    ],
    "lineHeight": {
      "value": 24,
      "unit": "PIXELS"
    },
    "letterSpacing": {
      "value": 0,
      "unit": "PIXELS"
    }
  }
]
```
