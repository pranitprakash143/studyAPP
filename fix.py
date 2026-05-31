import re

with open("src/app/subject/page.tsx", "r") as f:
    lines = f.readlines()

start_line = -1
for i, line in enumerate(lines):
    if '<ForceGraph2D' in line:
        start_line = i
        break

end_line = -1
if start_line != -1:
    for i in range(start_line, len(lines)):
        if '<div className="text-center text-slate-400 p-8 max-w-md">' in lines[i]:
            end_line = i - 1
            break

if start_line != -1 and end_line != -1:
    replacement_lines = [
        '                          <div className="w-full h-full bg-slate-900 rounded-xl overflow-hidden">\n',
        '                            <ReactFlowGraph\n',
        '                              nodes={mindmapData.nodes.map((n: any) => ({\n',
        '                                id: n.id,\n',
        '                                label: n.label,\n',
        '                                subject: subject\n',
        '                              }))}\n',
        '                              edges={mindmapData.links.map((e: any) => ({\n',
        '                                id: `${e.source.id || e.source}-${e.target.id || e.target}`,\n',
        '                                source: e.source.id || e.source,\n',
        '                                target: e.target.id || e.target,\n',
        '                                label: e.label\n',
        '                              }))}\n',
        '                            />\n',
        '                          </div>\n'
    ]
    lines = lines[:start_line-1] + replacement_lines + lines[end_line:]

content = "".join(lines)

content = content.replace(
    'const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });',
    'import ReactFlowGraph from "@/components/ReactFlowGraph";'
)

content = content.replace(
    'const [hoverNode, setHoverNode] = useState<any>(null);\n  const [neighborsMap, setNeighborsMap] = useState<Map<string, Set<string>>>(new Map());\n  const fgRef = useRef<any>(null);',
    ''
)

content = re.sub(
    r'// Compute connections map when mindmapData is set.*?setNeighborsMap\(map\);\n  }, \[mindmapData\]\);\n\n',
    '',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'// Center and fit the graph after loading or activeTab change\n  useEffect\(\(\) => \{\n    if \(fgRef\.current.*?\}, \[mindmapData, activeTab\]\);',
    '// Center and fit the graph after loading or activeTab change\n  useEffect(() => {\n  }, [mindmapData, activeTab]);',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'// Search Node\n  const handleSearchNode = \(query: string\) => \{\n.*?  \};\n',
    '// Search Node\n  const handleSearchNode = (query: string) => {\n  };\n',
    content,
    flags=re.DOTALL
)

with open("src/app/subject/page.tsx", "w") as f:
    f.write(content)
