import * as fs from "fs";
import * as path from "path";
import { convertToCode } from "backend";
import { PluginSettings, Framework } from "types";

// Mock figma global object
if (typeof global !== "undefined" && !(global as any).figma) {
    (global as any).figma = {
        mixed: Symbol("mixed"),
        variables: {
            getVariableByIdAsync: async () => null,
        },
        // Mock getNodeByIdAsync to avoid crashes if called, though it won't return anything useful for export
        getNodeByIdAsync: async () => null,
    };
}

// Mock document/window if needed by some shared code (like images.ts)
if (typeof global !== "undefined") {
    if (!(global as any).document) {
        (global as any).document = {
            createElement: () => ({
                getContext: () => null
            })
        };
    }
    if (!(global as any).window) {
        (global as any).window = global;
    }
}

const defaultSettings: PluginSettings = {
    framework: "HTML",
    htmlGenerationMode: "html",
    tailwindGenerationMode: "html",
    flutterGenerationMode: "snippet",
    swiftUIGenerationMode: "snippet",
    composeGenerationMode: "snippet",
    showLayerNames: false,
    embedImages: true,
    embedVectors: true,
    useColorVariables: true,
    roundTailwindValues: true,
    roundTailwindColors: true,
    useTailwind4: false,
    thresholdPercent: 0,
    baseFontSize: 16,
    baseFontFamily: "Inter",
    useOldPluginVersion2025: false,
    responsiveRoot: false,
};

// Helper to map kind -> type recursively and fix other property mismatches
const mapKindToType = (node: any, parent: any = null): any => {
    if (!node) return node;

    // Map 'kind' to 'type'
    if (node.kind && !node.type) {
        node.type = node.kind;
    }

    // Add parent reference
    if (parent) {
        node.parent = parent;
    }

    // Infer layoutPositioning based on parent's layoutMode
    if (!node.layoutPositioning && parent) {
        if (parent.layoutMode === "NONE") {
            node.layoutPositioning = "ABSOLUTE";
        } else if (parent.layoutMode === "HORIZONTAL" || parent.layoutMode === "VERTICAL") {
            node.layoutPositioning = "AUTO";
        }
    }

    // Set isRelative for containers with layoutMode: NONE
    if (node.layoutMode === "NONE" && node.children && node.children.length > 0) {
        node.isRelative = true;
    }

    // Promote 'visible' from style to top level if missing
    if (node.style?.visible !== undefined && node.visible === undefined) {
        node.visible = node.style.visible;
    }

    // Copy style properties to node level
    if (node.style) {
        const styleProps = [
            "fills", "strokes", "strokeWeight", "strokeAlign",
            "effects", "opacity", "blendMode", "visible"
        ];
        styleProps.forEach(prop => {
            if (node[prop] === undefined && node.style[prop] !== undefined) {
                node[prop] = node.style[prop];
            }
        });
    }

    // Convert cornerRadii object to cornerRadius number
    if (node.cornerRadii && !node.cornerRadius) {
        const radii = node.cornerRadii;
        const values = [radii.topLeft, radii.topRight, radii.bottomRight, radii.bottomLeft];
        const allSame = values.every(v => v === values[0]);
        node.cornerRadius = allSame ? values[0] : radii.topLeft;
    }

    // Convert padding object to individual padding properties
    if (node.padding && typeof node.padding === 'object') {
        if (node.padding.left !== undefined) node.paddingLeft = node.padding.left;
        if (node.padding.right !== undefined) node.paddingRight = node.padding.right;
        if (node.padding.top !== undefined) node.paddingTop = node.padding.top;
        if (node.padding.bottom !== undefined) node.paddingBottom = node.padding.bottom;
    }

    // Handle TEXT nodes
    if (node.type === "TEXT") {
        if (node.text && !node.characters) {
            node.characters = node.text;
        }

        if (!node.fontName && node.fontFamily) {
            let styleStr = "";
            if (node.fontWeight) {
                const weightMap: { [key: number]: string } = {
                    100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular",
                    500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Extra Bold", 900: "Black"
                };
                styleStr = weightMap[node.fontWeight] || String(node.fontWeight);
            }
            if (node.italic) {
                styleStr = styleStr ? styleStr + " Italic" : "Italic";
            }
            if (!styleStr) {
                styleStr = "Regular";
            }

            node.fontName = {
                family: node.fontFamily,
                style: styleStr
            };
        }

        if (!node.styledTextSegments) {
            const segment: any = {
                characters: node.characters || "",
                start: 0,
                end: (node.characters || "").length,
            };

            if (node.fontSize) segment.fontSize = node.fontSize;
            if (node.fontName) segment.fontName = node.fontName;
            if (node.fontWeight) segment.fontWeight = node.fontWeight;
            if (node.textDecoration) segment.textDecoration = node.textDecoration;
            if (node.textCase) segment.textCase = node.textCase;
            if (node.lineHeight) segment.lineHeight = node.lineHeight;
            if (node.letterSpacing) segment.letterSpacing = node.letterSpacing;
            if (node.fills) segment.fills = node.fills;
            if (node.textStyleId) segment.textStyleId = node.textStyleId;
            if (node.fillStyleId) segment.fillStyleId = node.fillStyleId;
            if (node.listOptions) segment.listOptions = node.listOptions;
            if (node.indentation) segment.indentation = node.indentation;
            if (node.hyperlink) segment.hyperlink = node.hyperlink;

            segment.openTypeFeatures = node.openTypeFeatures || {};

            node.styledTextSegments = [segment];
        }

        if (!node.textAutoResize) {
            node.textAutoResize = "NONE";
        }
    }

    if (node.primaryAlign) {
        node.primaryAxisAlignItems = node.primaryAlign;
    }
    if (node.counterAlign) {
        node.counterAxisAlignItems = node.counterAlign;
    }

    if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any) => mapKindToType(child, node));
    }

    return node;
};

async function main() {
    try {
        const inputPath = path.resolve(__dirname, "../../../../input/figma.json");
        const outputPath = path.resolve(__dirname, "../../../../out/index.html");

        console.log(`Reading input from ${inputPath}`);
        if (!fs.existsSync(inputPath)) {
            console.error("Input file not found!");
            process.exit(1);
        }

        const fileContent = fs.readFileSync(inputPath, "utf-8");
        const jsonData = JSON.parse(fileContent);

        const nodes = Array.isArray(jsonData) ? jsonData : jsonData.nodes || [];

        // Preprocess nodes
        nodes.forEach((node: any) => mapKindToType(node));

        console.log("Converting to HTML...");
        const generatedCode = await convertToCode(nodes, {
            ...defaultSettings,
            framework: "HTML",
        });

        // Wrap in a basic HTML structure
        const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Figma to Code Output</title>
    <style>
        body { margin: 0; padding: 0; font-family: sans-serif; }
    </style>
</head>
<body>
${generatedCode}
</body>
</html>`;

        console.log(`Writing output to ${outputPath}`);
        // Ensure output directory exists
        const outDir = path.dirname(outputPath);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, fullHtml);
        console.log("Conversion successful!");

    } catch (error) {
        console.error("Error converting:", error);
        process.exit(1);
    }
}

main();
