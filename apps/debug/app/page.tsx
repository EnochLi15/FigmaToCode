"use client";

import { Framework, PluginSettings } from "types";
import * as React from "react";
import { PluginUI } from "plugin-ui";
import { convertToCode } from "backend";

// Mock figma global object for browser environment
if (typeof window !== "undefined" && !(window as any).figma) {
  (window as any).figma = {
    mixed: Symbol("mixed"),
    variables: {
      getVariableByIdAsync: async () => null,
    },
  };
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

export default function Web() {
  const [selectedFramework, setSelectedFramework] =
    React.useState<Framework>("HTML");
  const [code, setCode] = React.useState("code goes hereeeee");
  const [jsonData, setJsonData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [settings, setSettings] = React.useState<PluginSettings>(defaultSettings);

  const testWarnings = ["This is an example of a conversion warning message."];

  React.useEffect(() => {
    if (jsonData) {
      const run = async () => {
        setIsLoading(true);
        try {
          const nodes = Array.isArray(jsonData)
            ? jsonData
            : jsonData.nodes || [];

          // Helper to map kind -> type recursively and fix other property mismatches
          const mapKindToType = (node: any): any => {
            if (!node) return node;
            if (node.kind && !node.type) {
              node.type = node.kind;
            }
            // Map 'text' to 'characters' for TEXT nodes if 'characters' is missing
            if (node.type === "TEXT") {
              if (node.text && !node.characters) {
                node.characters = node.text;
              }
              // Polyfill styledTextSegments if missing
              if (!node.styledTextSegments && node.style) {
                node.styledTextSegments = [
                  {
                    characters: node.characters || "",
                    start: 0,
                    end: (node.characters || "").length,
                    fontSize: node.fontSize || node.style.fontSize,
                    fontName: node.fontName || {
                      family: node.fontFamily || node.style.fontFamily,
                      style: String(node.fontWeight || node.style.fontWeight || "Regular") + (node.italic ? " Italic" : ""),
                    },
                    fontWeight: node.fontWeight || node.style.fontWeight,
                    textDecoration: node.textDecoration || node.style.textDecoration,
                    textCase: node.textCase || node.style.textCase,
                    lineHeight: node.lineHeight || node.style.lineHeight,
                    letterSpacing: node.letterSpacing || node.style.letterSpacing,
                    fills: node.fills || node.style.fills,
                    textStyleId: node.textStyleId || node.style.textStyleId,
                    fillStyleId: node.fillStyleId || node.style.fillStyleId,
                    listOptions: node.listOptions || node.style.listOptions,
                    indentation: node.indentation || node.style.indentation,
                    hyperlink: node.hyperlink || node.style.hyperlink,
                    openTypeFeatures: node.openTypeFeatures || node.style.openTypeFeatures || {},
                  },
                ];
              }
            }

            // Copy style properties to node level if missing
            if (node.style) {
              const styleProps = [
                "fills", "strokes", "strokeWeight", "strokeAlign",
                "effects", "opacity", "blendMode"
              ];
              styleProps.forEach(prop => {
                if (node[prop] === undefined && node.style[prop] !== undefined) {
                  node[prop] = node.style[prop];
                }
              });
            }

            if (node.children && Array.isArray(node.children)) {
              node.children.forEach(mapKindToType);
            }
            return node;
          };

          nodes.forEach(mapKindToType);

          const generatedCode = await convertToCode(nodes, {
            ...settings,
            framework: selectedFramework,
          });
          setCode(generatedCode);
        } catch (e) {
          console.error(e);
          setCode("Error converting code: " + e);
        } finally {
          setIsLoading(false);
        }
      };
      run();
    }
  }, [selectedFramework, jsonData, settings]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setJsonData(json);
    } catch (error) {
      console.error("Error parsing file:", error);
      alert("Error parsing file. Check console for details.");
      setIsLoading(false);
    }
  };

  const handlePreferenceChanged = (
    key: keyof PluginSettings,
    value: string | number | boolean,
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <header className="mb-10">
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
          Debug Mode
        </h1>
        <p className="text-gray-600 mt-2">
          Preview your Figma to Code plugin in both light and dark modes
        </p>

        <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Figma JSON (exported from plugin)
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        <div className="h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 mt-6"></div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col">
          <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-xl border border-gray-100">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Light Mode
            </h2>
            <div className="border rounded-xl">
              <PluginFigmaToolbar variant="(Light)" />
              <PluginUI
                code={code}
                isLoading={isLoading}
                selectedFramework={selectedFramework}
                setSelectedFramework={setSelectedFramework}
                htmlPreview={null}
                settings={settings}
                onPreferenceChanged={handlePreferenceChanged}
                colors={[]}
                gradients={[]}
                warnings={testWarnings}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="p-6 rounded-xl shadow-xl border border-gray-700 bg-[#2C2C2C]">
            <h2 className="text-2xl font-semibold mb-4 text-gray-100">
              Dark Mode
            </h2>
            <div className="border rounded-xl dark">
              <PluginFigmaToolbar variant="(Dark)" />
              <PluginUI
                code={code}
                isLoading={isLoading}
                selectedFramework={selectedFramework}
                setSelectedFramework={setSelectedFramework}
                htmlPreview={null}
                settings={settings}
                onPreferenceChanged={handlePreferenceChanged}
                colors={[]}
                gradients={[]}
                warnings={testWarnings}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PluginFigmaToolbar = (props: { variant: string }) => (
  <div className="bg-neutral-800 w-full h-12 flex items-center text-white gap-4 px-5 rounded-t-lg shadow-sm">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-red-500"></div>
      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
      <div className="w-3 h-3 rounded-full bg-green-500"></div>
    </div>
    <span className="font-medium ml-2">Figma to Code {props.variant}</span>
  </div>
);
