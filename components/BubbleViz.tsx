import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Transaction, AddressNode, TxType } from '../types';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Search, X, ArrowUpRight, ArrowDownLeft, Filter, List, Activity, Coins, CheckSquare, Square, Users, Check, Copy, Waypoints, Calendar, Loader2, Layers, Network, ChevronRight, MousePointer2, RefreshCcw, ShieldCheck, Target, ArrowRight, Share2, GitMerge, GitBranch, Trash2 } from 'lucide-react';
import { SUPPORTED_CHAINS } from '@/lib/constants';
import { toast } from 'sonner';

const d3Any = d3 as any;
const MotionDiv = motion.div as any;

interface BubbleVizProps {
  data: Transaction[];
  activeType: TxType;
  setActiveType: (type: TxType) => void;
  onAddData: (newTxns: Transaction[]) => void;
  onDeleteData: (threshold: number, type: TxType) => void;
  onDeleteToken: (token: string) => void;
  theme: 'light' | 'dark';
  baseAddresses: Set<string>;
}

const DEFAULT_SMALL_GROUP_COLOR = '#334155';
const GROUP_THRESHOLD = 3;
const colorInterpolator = d3Any.interpolateSinebow;

const getAge = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const getNodeType = (id: string) => {
  if (id.toLowerCase().includes('binance') || id.toLowerCase().includes('kraken')) return 'exchange';
  if (id.toLowerCase().includes('bridge') || id.toLowerCase().includes('safe')) return 'contract';
  return 'wallet';
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
  return num.toFixed(2);
}

const truncate = (str: string) => {
  if (str.length <= 10) return str;
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
};

const BubbleViz: React.FC<BubbleVizProps> = ({ data, activeType, setActiveType, onAddData, onDeleteData, onDeleteToken, theme, baseAddresses }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const simNodesRef = useRef<any[]>([]);
  const zoomTransformRef = useRef<any>(d3Any.zoomIdentity);
  const simulationRef = useRef<any>(null);

  const controlsDragControls = useDragControls();

  const [selectedNode, setSelectedNode] = useState<AddressNode | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showNodeList, setShowNodeList] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Toggle for Cross-Address Relationship Graph
  const [showRelatedOnly, setShowRelatedOnly] = useState(false);

  const [dateRange, setDateRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });
  const [dustThreshold, setDustThreshold] = useState<number | ''>('');
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [isDeletingDust, setIsDeletingDust] = useState(false);

  const handleDeleteDustWrapper = () => {
    if (dustThreshold === '' || dustThreshold <= 0) return;
    setIsDeletingDust(true);
    setTimeout(() => {
      onDeleteData(dustThreshold as number, activeType);
      setIsDeletingDust(false);
    }, 500);
  };

  // Trace Next Hop State
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [isTracing, setIsTracing] = useState(false);
  const [traceStatus, setTraceStatus] = useState<string>('');

  // Trace Targets: The addresses actively selected to run the query on
  const [traceTargets, setTraceTargets] = useState<Set<string>>(new Set());

  // Traced Addresses: Tracks which addresses have ALREADY been API-queried to prevent loops
  const [tracedAddresses, setTracedAddresses] = useState<Set<string>>(new Set());

  const [traceConfig, setTraceConfig] = useState({
    network: 'TRON',
    includeNative: true,
    includeERC20: true,
    direction: 'both' as 'both' | 'from' | 'to',
    hops: 1,
    start: '',
    end: ''
  });

  const panelBg = theme === 'light' ? 'bg-white' : 'bg-[#1a1a1a]';
  const panelBorder = theme === 'light' ? 'border-black' : 'border-gray-600';
  const textMain = theme === 'light' ? 'text-black' : 'text-gray-100';
  const textSub = theme === 'light' ? 'text-gray-500' : 'text-gray-400';
  const gridColor = theme === 'light' ? '#e2e8f0' : '#333333';
  const linkColor = theme === 'light' ? '#52525b' : '#a1a1aa';

  const availableTokens = useMemo(() => {
    const tokens = new Set<string>();
    data.filter(t => t.type === activeType).forEach(t => {
      if (t.token) tokens.add(t.token);
    });
    return Array.from(tokens).filter(Boolean).sort();
  }, [data, activeType]);

  useEffect(() => {
    if (availableTokens.length > 0) {
      setSelectedTokens(new Set(availableTokens));
    }
  }, [activeType, data]);

  // --- D3 DATA PREPARATION & HOP CALCULATION (STRICT BFS) ---
  const { nodes, links, radiusScale } = useMemo(() => {
    const balanceMap = new Map<string, number>();
    const adj = new Map<string, Set<string>>(); // Adjacency list for BFS
    const linkMap = new Map<string, { source: string, target: string, value: number, count: number, isBidirectional?: boolean }>();

    // 1. Process Links & Balances
    let filteredData = data.filter(t => t.type === activeType);
    if (dateRange.start) filteredData = filteredData.filter(t => new Date(t.timestamp) >= dateRange.start!);
    if (dateRange.end) {
      const eod = new Date(dateRange.end);
      eod.setHours(23, 59, 59, 999);
      filteredData = filteredData.filter(t => new Date(t.timestamp) <= eod);
    }
    const thresholdVal = typeof dustThreshold === 'number' ? dustThreshold : 0;
    if (thresholdVal > 0) filteredData = filteredData.filter(t => t.value >= thresholdVal);

    if (availableTokens.length > 0) {
      const tokensToFilter = selectedTokens.size > 0 ? selectedTokens : new Set(availableTokens);
      filteredData = filteredData.filter(t => t.token && tokensToFilter.has(t.token));
    }

    filteredData.forEach(tx => {
      balanceMap.set(tx.from, (balanceMap.get(tx.from) || 0) + tx.value);
      balanceMap.set(tx.to, (balanceMap.get(tx.to) || 0) + tx.value);

      // Build Undirected Graph for Topology
      if (!adj.has(tx.from)) adj.set(tx.from, new Set());
      if (!adj.has(tx.to)) adj.set(tx.to, new Set());
      adj.get(tx.from)!.add(tx.to);
      adj.get(tx.to)!.add(tx.from);

      const key = `${tx.from}-${tx.to}`;
      if (!linkMap.has(key)) {
        linkMap.set(key, { source: tx.from, target: tx.to, value: 0, count: 0 });
      }
      const link = linkMap.get(key)!;
      link.value += tx.value;
      link.count += 1;
    });

    let validNodes = new Set<string>(balanceMap.keys());
    let preFilteredLinks = Array.from(linkMap.values()).filter(l => validNodes.has(l.source) && validNodes.has(l.target));
    const linkKeys = new Set(preFilteredLinks.map(l => `${l.source}-${l.target}`));

    preFilteredLinks.forEach(l => {
      if (linkKeys.has(`${l.target}-${l.source}`)) {
        l.isBidirectional = true;
      }
    });

    // 2. Strict BFS for Hop Calculation (Topology Enforcement)
    const computedHopMap = new Map<string, number>();
    const queue: { id: string, level: number }[] = [];
    const visited = new Set<string>();

    baseAddresses.forEach(base => {
      for (const validNode of validNodes) {
        if (validNode.toLowerCase() === base.toLowerCase()) {
          computedHopMap.set(validNode, 0);
          queue.push({ id: validNode, level: 0 });
          visited.add(validNode);
        }
      }
    });

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      const neighbors = adj.get(id);

      if (neighbors) {
        neighbors.forEach(neighborId => {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            const nextLevel = level + 1;
            computedHopMap.set(neighborId, nextLevel);
            queue.push({ id: neighborId, level: nextLevel });
          }
        });
      }
    }

    let computedNodes: AddressNode[] = [];
    let nodeSet = new Set<string>();

    // Union Find for Clusters
    const parent = new Map<string, string>();
    const find = (i: string): string => {
      if (!parent.has(i)) parent.set(i, i);
      if (parent.get(i) === i) return i;
      return find(parent.get(i)!);
    };
    const union = (i: string, j: string) => { const rootI = find(i); const rootJ = find(j); if (rootI !== rootJ) parent.set(rootI, rootJ); };

    preFilteredLinks.forEach(l => {
      nodeSet.add(l.source);
      nodeSet.add(l.target);
      union(l.source, l.target);
    });

    validNodes.forEach(id => { if (!nodeSet.has(id)) { nodeSet.add(id); parent.set(id, id); } });

    const componentCounts = new Map<string, number>();
    nodeSet.forEach(id => { const root = find(id); componentCounts.set(root, (componentCounts.get(root) || 0) + 1); });

    const rootColors = new Map<string, string>();
    let colorCounter = 0;
    const goldenRatio = 0.618033988749895;

    // 3. Node Construction
    nodeSet.forEach(id => {
      const bal = balanceMap.get(id) || 0;
      const root = find(id);
      const groupSize = componentCounts.get(root) || 1;

      let color = theme === 'light' ? DEFAULT_SMALL_GROUP_COLOR : '#94a3b8';
      let gid = 0;

      if (groupSize > GROUP_THRESHOLD) {
        if (!rootColors.has(root)) {
          colorCounter += goldenRatio;
          colorCounter %= 1;
          rootColors.set(root, colorInterpolator(colorCounter));
        }
        color = rootColors.get(root)!;
        gid = 1;
      }

      const hopLevel = computedHopMap.get(id);

      computedNodes.push({
        id,
        balance: bal,
        type: getNodeType(id) as any,
        activityScore: Math.random(),
        groupId: gid,
        groupSize: groupSize,
        groupColor: color,
        hop: hopLevel
      });
    });

    // --- APPLY "CROSS-ADDRESS RELATIONSHIP" FILTER ---
    // If enabled, strictly filter nodes to those connected to Base addresses.
    // RULE: "Only present bubbles where the direct relationship downwards has 2 or more bubbles".
    // Logic: 
    // 1. Keep all Base Nodes (Hop 0).
    // 2. Keep all Nodes with Hop >= 2 (Chain length >= 2 guaranteed).
    // 3. Prune Hop 1 Nodes (Direct neighbors) IF they are NOT connected to any other non-Base node.
    //    (i.e. prune stubs like Base -> A, keep chains like Base -> A -> B)
    let finalNodes = computedNodes;
    if (showRelatedOnly) {
      finalNodes = computedNodes.filter(n => {
        // Must be part of a base-rooted tree
        if (n.hop === undefined) return false;

        // Keep Root
        if (n.hop === 0) return true;

        // Keep Deep Nodes (Hop 2, 3...)
        if (n.hop >= 2) return true;

        // Filter Hop 1 Nodes
        if (n.hop === 1) {
          const neighbors = adj.get(n.id);
          if (!neighbors) return false;

          for (const neighborId of neighbors) {
            const h = computedHopMap.get(neighborId);
            // Keep if neighbor exists in the tree AND is not a base node (hop > 0)
            // This implies the Hop 1 node is a bridge to a Hop 2 node or part of a Hop 1 cluster
            if (h !== undefined && h > 0) {
              return true;
            }
          }
          // If all neighbors are Base nodes (Hop 0), then it's a leaf at depth 1. Remove it.
          return false;
        }

        return false;
      });
    }

    const finalNodeSet = new Set(finalNodes.map(n => n.id));
    const finalLinks = preFilteredLinks.filter(l => finalNodeSet.has(l.source) && finalNodeSet.has(l.target));

    const minBal = Math.min(...finalNodes.map(n => n.balance)) || 0.001;
    const maxBal = Math.max(...finalNodes.map(n => n.balance)) || 1;

    const rScale = d3Any.scaleSqrt().domain([minBal, maxBal]).range([20, 80]).clamp(true);

    return { nodes: finalNodes, links: finalLinks, radiusScale: rScale };
  }, [data, activeType, dateRange, dustThreshold, selectedTokens, theme, baseAddresses, availableTokens, showRelatedOnly]);


  // --- TRACE CANDIDATE MANAGEMENT ---
  const candidateList = useMemo(() => {
    const pool = nodes.filter(n => (n.hop !== undefined || baseAddresses.has(n.id.toLowerCase())));
    return pool.filter(n => !tracedAddresses.has(n.id.toLowerCase())).sort((a, b) => {
      const hopA = a.hop ?? 0;
      const hopB = b.hop ?? 0;
      if (hopA !== hopB) return hopB - hopA;
      return 0;
    });
  }, [nodes, baseAddresses, tracedAddresses]);

  const groupedCandidates = useMemo(() => {
    const groups = new Map<number, AddressNode[]>();
    candidateList.forEach(node => {
      const hop = node.hop ?? 0;
      if (!groups.has(hop)) groups.set(hop, []);
      groups.get(hop)!.push(node);
    });
    return Array.from(groups.keys()).sort((a, b) => a - b).map(hop => ({
      hop,
      label: hop === 0 ? 'Base (0)' : `Hop ${hop}`,
      nodes: groups.get(hop)!
    }));
  }, [candidateList]);


  // --- TRACE MODAL: AUTO-SELECTION ---
  useEffect(() => {
    if (showTraceModal) {
      let maxHop = -1;
      nodes.forEach(n => {
        if (n.hop !== undefined && n.hop > maxHop && !tracedAddresses.has(n.id.toLowerCase())) {
          maxHop = n.hop;
        }
      });

      if (maxHop > -1) {
        const targets = new Set<string>();
        nodes.forEach(n => {
          if (n.hop === maxHop && !tracedAddresses.has(n.id.toLowerCase())) {
            targets.add(n.id);
          }
        });
        setTraceTargets(targets);
      } else {
        setTraceTargets(new Set());
      }

      const today = new Date();
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);

      if (!traceConfig.start) {
        setTraceConfig(prev => ({
          ...prev,
          hops: 1,
          start: lastWeek.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0],
          direction: 'both'
        }));
      }
      setTraceStatus('');
    }
  }, [showTraceModal]);

  const toggleToken = (token: string) => {
    const newSet = new Set(selectedTokens);
    if (newSet.has(token)) newSet.delete(token);
    else newSet.add(token);
    setSelectedTokens(newSet);
  };

  const toggleAllTokens = () => {
    if (selectedTokens.size === availableTokens.length) {
      setSelectedTokens(new Set());
    } else {
      setSelectedTokens(new Set(availableTokens));
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const handleTraceExecution = async () => {
    if (traceTargets.size === 0) {
      toast.error("Selection Required", {
        description: "Please select at least one Target Address to trace from."
      });
      return;
    }

    setIsTracing(true);
    setTraceStatus('Initializing...');

    try {
      let range = undefined;
      if (traceConfig.start && traceConfig.end) {
        const endObj = new Date(traceConfig.end);
        endObj.setHours(23, 59, 59, 999);
        range = { start: new Date(traceConfig.start), end: endObj };
      }

      const knownAddresses = new Set<string>();
      data.forEach(t => {
        knownAddresses.add(t.from.toLowerCase());
        knownAddresses.add(t.to.toLowerCase());
      });

      const sessionVisited = new Set<string>(Array.from(tracedAddresses).map(a => a.toLowerCase()));
      Array.from(traceTargets).forEach((t: string) => sessionVisited.add(t.toLowerCase()));

      let currentFrontier = Array.from(traceTargets);
      const allNewTransactions: Transaction[] = [];

      for (let i = 0; i < traceConfig.hops; i++) {
        if (currentFrontier.length === 0) {
          setTraceStatus(`Finished at Hop ${i}. No new frontier.`);
          break;
        }

        setTraceStatus(`Scanning Hop Layer ${i + 1}/${traceConfig.hops}... (${currentFrontier.length} Targets)`);

        const nextFrontier = new Set<string>();
        const layerTransactions: Transaction[] = [];

        const BATCH_SIZE = 5;
        for (let j = 0; j < currentFrontier.length; j += BATCH_SIZE) {
          const batch = currentFrontier.slice(j, j + BATCH_SIZE);

          await Promise.allSettled(batch.map(async (address) => {
            // const { data: resultData } = await fetchAddressHistory(address, traceConfig.network, range);
            const response = await fetch('/api/address-history', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ address: address, chainId: traceConfig.network, range }),
            });
            const resultData = await response.json();
            const txs = resultData as Transaction[];

            txs.forEach((tx: Transaction) => {
              if (tx.type === 'native' && !traceConfig.includeNative) return;
              if (tx.type === 'erc20' && !traceConfig.includeERC20) return;

              const fromAddr = (tx.from || '').toLowerCase();
              const toAddr = (tx.to || '').toLowerCase();
              const currentAddr = address.toLowerCase();

              const isFrom = fromAddr === currentAddr;
              const isTo = toAddr === currentAddr;

              let isValidDirection = false;
              let neighbor = '';

              if (traceConfig.direction === 'from') {
                if (isFrom) { isValidDirection = true; neighbor = tx.to; }
              } else if (traceConfig.direction === 'to') {
                if (isTo) { isValidDirection = true; neighbor = tx.from; }
              } else {
                if (isFrom || isTo) {
                  isValidDirection = true;
                  neighbor = isFrom ? tx.to : tx.from;
                }
              }

              if (isValidDirection && neighbor) {
                const neighborLower = neighbor.toLowerCase();

                layerTransactions.push(tx);

                if (!sessionVisited.has(neighborLower)) {
                  nextFrontier.add(neighborLower);
                }
              }
            });
          }));

          if (j + BATCH_SIZE < currentFrontier.length) {
            await new Promise(r => setTimeout(r, 500));
          }
        }

        allNewTransactions.push(...layerTransactions);

        currentFrontier.forEach((addr: string) => sessionVisited.add(addr.toLowerCase()));
        currentFrontier = Array.from(nextFrontier);

        if (layerTransactions.length > 0) {
          // onAddData(layerTransactions); 
        }
      }

      setTraceStatus('Finalizing...');

      if (allNewTransactions.length > 0) {
        onAddData(allNewTransactions);
        setTracedAddresses(prev => {
          const next = new Set(prev);
          sessionVisited.forEach(v => next.add(v));
          return next;
        });

        toast.success("Trace Complete", {
          description: `Successfully traced ${allNewTransactions.length} new transactions.`
        });
        setShowTraceModal(false);
      } else {
        setTracedAddresses(prev => {
          const next = new Set(prev);
          traceTargets.forEach((t: string) => next.add(t.toLowerCase()));
          return next;
        });
        toast.info("No New Data", {
          description: "Trace complete, but no new transactions were found."
        });
        setShowTraceModal(false);
      }

    } catch (err) {
      console.error("Trace failed", err);
      toast.error("Trace Failed", {
        description: "An error occurred during the trace operation. Check console for details."
      });
    } finally {
      setIsTracing(false);
      setTraceStatus('');
    }
  };

  // D3 Logic
  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;
    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;
    const svg = d3Any.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrow-head-default")
      .attr("viewBox", "0 -2 10 4")
      .attr("refX", 0)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 3)
      .attr("markerUnits", "userSpaceOnUse")
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-2L10,0L0,2")
      .attr("fill", linkColor);

    const pattern = defs.append("pattern").attr("id", "grid-pattern").attr("width", 50).attr("height", 50).attr("patternUnits", "userSpaceOnUse");
    pattern.append("path").attr("d", "M 50 0 L 0 0 0 50").attr("fill", "none").attr("stroke", gridColor).attr("stroke-width", 0.5);
    svg.append("rect").attr("width", "100%").attr("height", "100%").attr("fill", "url(#grid-pattern)");

    const simLinks = links.map(d => ({ ...d }));
    const simNodes = nodes.map(n => {
      const prev = simNodesRef.current.find((p: any) => p.id === n.id);
      return {
        ...n,
        x: prev ? prev.x : width / 2 + (Math.random() - 0.5) * 100,
        y: prev ? prev.y : height / 2 + (Math.random() - 0.5) * 100,
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0,
        fx: prev ? prev.fx : null,
        fy: prev ? prev.fy : null
      };
    });
    simNodesRef.current = simNodes;

    const g = svg.append("g");
    const linkGroup = g.append("g").attr("class", "links");
    const nodeGroup = g.append("g").attr("class", "nodes");

    const zoom = d3Any.zoom().scaleExtent([0.1, 4]).on("zoom", (event: any) => {
      g.attr("transform", event.transform);
      zoomTransformRef.current = event.transform;
    });
    svg.call(zoom as any).on("dblclick.zoom", null).call(zoom.transform as any, zoomTransformRef.current);

    svg.on("click", (e: any) => {
      if (e.target.tagName === 'svg' || e.target.tagName === 'rect') {
        setSelectedNode(null);
      }
    });

    const simulation = d3Any.forceSimulation(simNodes as any)
      .force("link", d3Any.forceLink(simLinks).id((d: any) => d.id).distance(250).strength(0.05))
      .force("charge", d3Any.forceManyBody().strength(-400))
      .force("collide", d3Any.forceCollide().radius((d: any) => radiusScale(d.balance) + 40).strength(0.8))
      .force("center", d3Any.forceCenter(width / 2, height / 2).strength(0.05));

    simulationRef.current = simulation;

    const linkPath = linkGroup.selectAll("path")
      .data(simLinks)
      .join("path")
      .attr("stroke", linkColor)
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow-head-default)")
      .attr("fill", "none")
      .attr("opacity", 0.7);

    const node = nodeGroup.selectAll("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "grab")
      .call(d3Any.drag()
        .on("start", (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
          d3Any.select(event.sourceEvent.target.parentNode).attr("cursor", "grabbing");
        })
        .on("drag", (event: any, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", function (event: any, d: any) {
          if (!event.active) simulation.alphaTarget(0);
          d3Any.select(this).attr("cursor", "grab");
          d3Any.select(this).select("circle.node-circle").attr("stroke-dasharray", "4,2").attr("stroke-width", 3).attr("stroke", "#f59e0b");
          d3Any.select(this).select(".lock-badge").attr("display", "block");
        })
      )
      .on("dblclick", function (e: any, d: any) {
        e.stopPropagation();
        d.fx = null;
        d.fy = null;
        simulation.alpha(0.3).restart();
        d3Any.select(this).select("circle.node-circle").attr("stroke-dasharray", "0").attr("stroke-width", 2).attr("stroke", theme === 'light' ? "#fff" : "#000");
        d3Any.select(this).select(".lock-badge").attr("display", "none");
      })
      .on("click", (e: any, d: any) => {
        e.stopPropagation();
        setSelectedNode(d);
      })
      .on("mouseover", function (event: any, d: any) {
        d3Any.select(this).select("text.label").transition().duration(200).style("font-size", "12px");
        if (d.fx === null) {
          d3Any.select(this).select("circle.node-circle").attr("stroke", "#3b82f6").attr("stroke-width", 3);
        }
        d3Any.select(this).raise();
        if (tooltipRef.current) {
          const tooltip = d3Any.select(tooltipRef.current);
          tooltip.style("opacity", 1);
          tooltip.html(d.id);
        }
      })
      .on("mousemove", function (event: any) {
        if (tooltipRef.current && wrapperRef.current) {
          const [x, y] = d3Any.pointer(event, wrapperRef.current);
          d3Any.select(tooltipRef.current).style("left", x + "px").style("top", (y + 20) + "px").style("transform", "translateX(-50%)");
        }
      })
      .on("mouseout", function (event: any, d: any) {
        d3Any.select(this).select("text.label").transition().duration(200).style("opacity", 1).style("font-size", "9px").attr("fill", "white");
        if (d.fx === null) d3Any.select(this).select("circle.node-circle").attr("stroke", theme === 'light' ? "#fff" : "#000").attr("stroke-width", 2);
        if (tooltipRef.current) d3Any.select(tooltipRef.current).style("opacity", 0);
      });

    node.append("circle")
      .attr("class", "node-circle")
      .attr("r", (d: any) => radiusScale(d.balance))
      .attr("fill", (d: any) => d.groupColor)
      .attr("stroke", (d: any) => d.fx !== null ? "#f59e0b" : (theme === 'light' ? "#fff" : "#000"))
      .attr("stroke-width", (d: any) => d.fx !== null ? 3 : 2)
      .attr("stroke-dasharray", (d: any) => d.fx !== null ? "4,2" : "0")
      .attr("class", "shadow-sm transition-colors");

    // Base Node Badge (0)
    node.filter((d: any) => d.hop === 0)
      .append("g")
      .attr("transform", (d: any) => {
        const r = radiusScale(d.balance);
        const angle = -Math.PI / 4;
        return `translate(${r * Math.cos(angle)},${r * Math.sin(angle)})`;
      })
      .each(function () {
        const g = d3Any.select(this);
        g.append("circle").attr("r", 8).attr("fill", "#ef4444").attr("stroke", "#fff").attr("stroke-width", 1.5);
        g.append("text").text("0").attr("dy", ".35em").attr("text-anchor", "middle").attr("fill", "white").attr("font-size", "10px").attr("font-weight", "900");
      });

    // Next Hop Badge (1, 2, ...)
    node.filter((d: any) => d.hop !== undefined && d.hop > 0)
      .append("g")
      .attr("transform", (d: any) => {
        const r = radiusScale(d.balance);
        const angle = -Math.PI / 4;
        return `translate(${r * Math.cos(angle)},${r * Math.sin(angle)})`;
      })
      .each(function (d: any) {
        const g = d3Any.select(this);
        g.append("circle").attr("r", 8).attr("fill", theme === 'light' ? "#3b82f6" : "#2563eb").attr("stroke", "#fff").attr("stroke-width", 1.5);
        g.append("text").text(d.hop).attr("dy", ".35em").attr("text-anchor", "middle").attr("fill", "white").attr("font-size", "10px").attr("font-weight", "900");
      });

    // Lock Badge
    node.append("g").attr("class", "lock-badge").attr("display", (d: any) => d.fx !== null ? "block" : "none")
      .attr("transform", (d: any) => {
        const r = radiusScale(d.balance);
        const angle = -3 * Math.PI / 4;
        return `translate(${r * Math.cos(angle)},${r * Math.sin(angle)})`;
      })
      .each(function () {
        const g = d3Any.select(this);
        g.append("circle").attr("r", 7).attr("fill", "#f59e0b").attr("stroke", "#fff").attr("stroke-width", 1.5);
        g.append("path").attr("d", "M-2.5 -1 h5 v3.5 h-5 z M -1.5 -1 v-1.5 a 1.5 1.5 0 0 1 3 0 v 1.5").attr("fill", "white");
      });

    node.append("text").attr("class", "label").text((d: any) => truncate(d.id)).attr("text-anchor", "middle").attr("dy", ".35em").attr("fill", "white").attr("font-size", "9px").attr("font-weight", "bold").attr("pointer-events", "none");

    simulation.on("tick", () => {
      linkPath.attr("d", (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return "";
        const ux = dx / dist;
        const uy = dy / dist;
        const sourceR = radiusScale(d.source.balance);
        const targetR = radiusScale(d.target.balance);
        const markerLength = 10;
        const padding = 6;

        if (d.isBidirectional) {
          const curveFactor = 40;
          const midX = (d.source.x + d.target.x) / 2;
          const midY = (d.source.y + d.target.y) / 2;
          const cx = midX + uy * curveFactor;
          const cy = midY - ux * curveFactor;
          const startX = d.source.x + ux * (sourceR + padding);
          const startY = d.source.y + uy * (sourceR + padding);
          const endX = d.target.x - ux * (targetR + markerLength + padding);
          const endY = d.target.y - uy * (targetR + markerLength + padding);
          return `M${startX},${startY} Q${cx},${cy} ${endX},${endY}`;
        } else {
          const startX = d.source.x + ux * (sourceR + padding);
          const startY = d.source.y + uy * (sourceR + padding);
          const endX = d.target.x - ux * (targetR + markerLength + padding);
          const endY = d.target.y - uy * (targetR + markerLength + padding);
          return `M${startX},${startY} L${endX},${endY}`;
        }
      });
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [nodes, links, radiusScale, theme, linkColor, baseAddresses]);

  // Selected Stats
  const selectedStats = useMemo(() => {
    if (!selectedNode) return null;
    const txs = data.filter(t => t.type === activeType).filter(t => t.from === selectedNode.id || t.to === selectedNode.id);
    const sentTxs = txs.filter(t => t.from === selectedNode.id);
    const sentVal = sentTxs.reduce((acc, t) => acc + t.value, 0);
    const receivedTxs = txs.filter(t => t.to === selectedNode.id);
    const receivedVal = receivedTxs.reduce((acc, t) => acc + t.value, 0);
    return { sentVal, receivedVal, totalCount: txs.length, history: txs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)) };
  }, [selectedNode, data, activeType]);

  return (
    <div ref={wrapperRef} className={`relative w-full h-screen  overflow-hidden font-sans select-none ${theme === 'light' ? 'bg-slate-50' : 'bg-[#111]'}`}>
      <svg ref={svgRef} className="w-full h-full" />

      <div ref={tooltipRef} className="pointer-events-none fixed bg-black/90 text-white px-3 py-2 rounded text-xs font-mono font-bold z-50 border border-white/20 whitespace-nowrap shadow-xl backdrop-blur-sm opacity-0 transition-opacity duration-75" style={{ left: 0, top: 0 }} />

      <div className="absolute top-4 left-4 z-30 flex flex-col gap-2 pointer-events-none">
        <div className={`flex ${theme === 'light' ? 'bg-white/90 border-black' : 'bg-gray-900/90 border-white/50'} backdrop-blur border-2 neo-shadow-sm pointer-events-auto p-1 gap-1`}>
          <button onClick={() => setActiveType('native')} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-transparent transition-all ${activeType === 'native' ? (theme === 'light' ? 'bg-black text-white border-black' : 'bg-white text-black border-white') : (theme === 'light' ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-gray-800 text-gray-400')}`}>
            <Activity size={14} /> Transactions
          </button>
          <button onClick={() => setActiveType('erc20')} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-transparent transition-all ${activeType === 'erc20' ? 'bg-blue-600 text-white border-blue-800' : (theme === 'light' ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-gray-800 text-gray-400')}`}>
            <Coins size={14} /> Token Transfers
          </button>
        </div>
        <div className={`px-3 py-1 text-[10px] font-mono border-2 self-start pointer-events-auto shadow-lg flex gap-3 ${theme === 'light' ? 'bg-black text-white border-white/20' : 'bg-white text-black border-black'}`}>
          <span>NODES: {nodes.length}</span>
          <span className="opacity-50">|</span>
          <span>LINKS: {links.length}</span>
          {baseAddresses.size > 0 && (<><span className="opacity-50">|</span><span className="text-red-500">BASE: {baseAddresses.size}</span></>)}
        </div>
      </div>

      <div className="absolute top-4 right-4 z-30 flex gap-2">
        <button
          onClick={() => setShowRelatedOnly(!showRelatedOnly)}
          className={`p-3 border-2 neo-shadow-hover transition-colors flex items-center gap-2 ${showRelatedOnly ? (theme === 'light' ? 'bg-red-500 text-white border-red-700' : 'bg-red-600 text-white border-red-400') : (theme === 'light' ? 'bg-white text-black border-black' : 'bg-[#222] text-white border-white/20')}`}
          title={showRelatedOnly ? "Exit Relationship View" : "Enter Cross-Address Relationship View"}
        >
          {showRelatedOnly ? <GitBranch size={18} /> : <Share2 size={18} />}
        </button>
        <button onClick={() => setShowTraceModal(true)} className={`p-3 border-2 neo-shadow-hover transition-colors flex items-center gap-2 ${showTraceModal ? (theme === 'light' ? 'bg-black text-white border-black' : 'bg-white text-black border-white') : (theme === 'light' ? 'bg-white text-black border-black' : 'bg-[#222] text-white border-white/20')}`} title="Trace Next Hop">
          <Waypoints size={18} />
        </button>
        <button onClick={() => setFiltersOpen(!filtersOpen)} className={`p-3 border-2 neo-shadow-hover transition-colors ${filtersOpen ? (theme === 'light' ? 'bg-black text-white border-black' : 'bg-white text-black border-white') : (theme === 'light' ? 'bg-white text-black border-black' : 'bg-[#222] text-white border-white/20')}`} title="Filters">
          <Filter size={18} />
        </button>
        <button onClick={() => setShowNodeList(!showNodeList)} className={`p-3 border-2 neo-shadow-hover transition-colors ${showNodeList ? (theme === 'light' ? 'bg-black text-white border-black' : 'bg-white text-black border-white') : (theme === 'light' ? 'bg-white text-black border-black' : 'bg-[#222] text-white border-white/20')}`} title="Network Participants">
          <List size={18} />
        </button>
      </div>

      {/* --- TRACE MODAL --- */}
      <AnimatePresence>
        {showTraceModal && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto">
            <MotionDiv initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className={`w-full max-w-lg ${panelBg} border-4 ${panelBorder} neo-shadow-lg p-6 relative ${textMain} max-h-[90vh] flex flex-col`}>
              <button onClick={() => setShowTraceModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={24} /></button>
              <div className="flex items-center gap-3 mb-6 shrink-0">
                <div className="bg-blue-600 text-white p-2 border-2 border-black"><Waypoints size={24} /></div>
                <h2 className="text-2xl font-black uppercase">Trace Next Hop</h2>
              </div>
              <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Target Network</label>
                  <div className="relative">
                    <select value={traceConfig.network} onChange={(e) => setTraceConfig({ ...traceConfig, network: e.target.value })} className={`w-full border-2 ${panelBorder} p-3 font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'light' ? 'bg-white' : 'bg-black text-white'}`}>
                      {SUPPORTED_CHAINS.map(chain => (
                        <option key={chain.id} value={chain.id}>{chain.name} ({chain.currency})</option>
                      ))}
                    </select>
                    <Network className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" size={16} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Target Addresses</label>
                  <div className={`p-4 border-2 ${panelBorder} ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'} flex items-center justify-between`}>
                    <div>
                      <div className="text-xl font-black">{traceTargets.size}</div>
                      <div className="text-[10px] font-bold uppercase text-gray-400">Addresses Selected</div>
                    </div>
                    <button
                      onClick={() => setShowSelectionModal(true)}
                      className={`px-4 py-2 text-xs font-black uppercase border-2 ${panelBorder} neo-shadow-hover transition-transform bg-yellow-400 text-black flex items-center gap-2`}
                    >
                      <Target size={14} /> Select Targets
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-gray-400 italic">
                    Tip: Use the selection window to filter by Hop Level (1, 2, 3...)
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Include Information</label>
                  <div className="flex gap-4">
                    <label className={`flex items-center gap-2 p-3 border-2 ${panelBorder} w-full cursor-pointer hover:bg-gray-100/10 transition-colors ${traceConfig.includeNative ? (theme === 'light' ? 'bg-blue-50' : 'bg-blue-900/20') : ''}`}>
                      <div onClick={() => setTraceConfig({ ...traceConfig, includeNative: !traceConfig.includeNative })}>{traceConfig.includeNative ? <CheckSquare className="text-blue-600" size={18} /> : <Square className="text-gray-400" size={18} />}</div>
                      <span className="font-bold text-sm">Transactions</span>
                    </label>
                    <label className={`flex items-center gap-2 p-3 border-2 ${panelBorder} w-full cursor-pointer hover:bg-gray-100/10 transition-colors ${traceConfig.includeERC20 ? (theme === 'light' ? 'bg-purple-50' : 'bg-purple-900/20') : ''}`}>
                      <div onClick={() => setTraceConfig({ ...traceConfig, includeERC20: !traceConfig.includeERC20 })}>{traceConfig.includeERC20 ? <CheckSquare className="text-purple-600" size={18} /> : <Square className="text-gray-400" size={18} />}</div>
                      <span className="font-bold text-sm">Transfers</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Trace Direction</label>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-3 p-3 border-2 ${panelBorder} cursor-pointer transition-colors ${traceConfig.direction === 'both' ? (theme === 'light' ? 'bg-black text-white' : 'bg-white text-black') : 'hover:bg-gray-100/10'}`}>
                      <input type="radio" name="direction" className="hidden" checked={traceConfig.direction === 'both'} onChange={() => setTraceConfig({ ...traceConfig, direction: 'both' })} />
                      <Layers size={18} />
                      <div className="flex-1"><div className="font-bold text-sm uppercase">From & To (Recommended)</div></div>
                      {traceConfig.direction === 'both' && <Check size={18} />}
                    </label>
                    <div className="flex gap-2">
                      <label className={`flex items-center gap-2 p-3 border-2 ${panelBorder} w-full cursor-pointer transition-colors ${traceConfig.direction === 'from' ? (theme === 'light' ? 'bg-black text-white' : 'bg-white text-black') : 'hover:bg-gray-100/10'}`}>
                        <input type="radio" name="direction" className="hidden" checked={traceConfig.direction === 'from'} onChange={() => setTraceConfig({ ...traceConfig, direction: 'from' })} />
                        <div className="flex-1"><div className="font-bold text-sm uppercase">Only From</div></div>
                      </label>
                      <label className={`flex items-center gap-2 p-3 border-2 ${panelBorder} w-full cursor-pointer transition-colors ${traceConfig.direction === 'to' ? (theme === 'light' ? 'bg-black text-white' : 'bg-white text-black') : 'hover:bg-gray-100/10'}`}>
                        <input type="radio" name="direction" className="hidden" checked={traceConfig.direction === 'to'} onChange={() => setTraceConfig({ ...traceConfig, direction: 'to' })} />
                        <div className="flex-1"><div className="font-bold text-sm uppercase">Only To</div></div>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Query Hops</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 5, 10].map(h => (
                        <button key={h} onClick={() => setTraceConfig({ ...traceConfig, hops: h })} className={`flex-1 py-2 text-xs font-bold border-2 ${panelBorder} transition-colors ${traceConfig.hops === h ? (theme === 'light' ? 'bg-black text-white' : 'bg-white text-black') : 'hover:bg-gray-100/10'}`}>{h}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500 flex items-center gap-2"><Calendar size={12} /> Date Range</label>
                    <div className="flex gap-2">
                      <input type="date" value={traceConfig.start} className={`w-full p-2 border-2 ${panelBorder} text-[10px] font-bold ${theme === 'light' ? 'bg-white' : 'bg-black text-white'}`} onChange={(e) => setTraceConfig({ ...traceConfig, start: e.target.value })} />
                      <input type="date" value={traceConfig.end} className={`w-full p-2 border-2 ${panelBorder} text-[10px] font-bold ${theme === 'light' ? 'bg-white' : 'bg-black text-white'}`} onChange={(e) => setTraceConfig({ ...traceConfig, end: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-4 border-t-2 border-gray-200 dark:border-gray-800 flex justify-between items-center shrink-0">
                <div className="text-[10px] font-black uppercase text-blue-500 animate-pulse">{traceStatus}</div>
                <div className="flex gap-3">
                  <button onClick={() => setShowTraceModal(false)} disabled={isTracing} className={`px-4 py-3 font-bold uppercase hover:bg-gray-100/10 transition-colors ${textSub} disabled:opacity-50`}>Cancel</button>
                  <button onClick={handleTraceExecution} disabled={isTracing} className={`px-8 py-3 bg-blue-600 text-white font-black uppercase tracking-widest border-2 ${panelBorder} neo-shadow-hover transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}>
                    {isTracing ? <Loader2 className="animate-spin" /> : <Waypoints size={18} />}
                    {isTracing ? 'Tracing...' : 'Run Query'}
                  </button>
                </div>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* --- TARGET SELECTION MODAL (NEW) --- */}
      <AnimatePresence>
        {showSelectionModal && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
            <MotionDiv initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className={`w-full max-w-2xl ${panelBg} border-4 ${panelBorder} neo-shadow-lg p-6 relative flex flex-col max-h-[85vh]`}>
              <div className="flex justify-between items-center mb-4 border-b-2 border-gray-200 dark:border-gray-700 pb-4">
                <h3 className={`text-xl font-black uppercase tracking-wider flex items-center gap-2 ${textMain}`}>
                  <Target size={20} className="text-yellow-500" /> Select Trace Targets
                </h3>
                <button onClick={() => setShowSelectionModal(false)} className="hover:rotate-90 transition-transform"><X size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {groupedCandidates.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 italic">No eligible un-traced addresses found.</div>
                ) : (
                  groupedCandidates.map(group => {
                    // Only filter out Base(0) if requested, currently showing all groups but prioritized
                    const groupSelectedCount = group.nodes.filter(n => traceTargets.has(n.id)).length;
                    const isAllSelected = groupSelectedCount === group.nodes.length && group.nodes.length > 0;

                    // Only default open if Hop > 0 or if it's the only group
                    const defaultOpen = group.hop > 0 || groupedCandidates.length === 1;

                    return (
                      <div key={group.hop} className="mb-6">
                        <div className="flex items-center justify-between mb-2 sticky top-0 bg-inherit z-10 py-1 border-b border-gray-200 dark:border-gray-800">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black px-2 py-1 rounded ${group.hop === 0 ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                              {group.label}
                            </span>
                            <span className="text-xs font-bold text-gray-400">({group.nodes.length} Nodes)</span>
                          </div>
                          <button
                            onClick={() => {
                              const newSet = new Set(traceTargets);
                              group.nodes.forEach(n => {
                                if (isAllSelected) newSet.delete(n.id);
                                else newSet.add(n.id);
                              });
                              setTraceTargets(newSet);
                            }}
                            className="text-[10px] font-bold uppercase underline text-blue-500 hover:text-blue-600"
                          >
                            {isAllSelected ? 'Deselect Group' : 'Select Group'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {group.nodes.map(node => {
                            const isSelected = traceTargets.has(node.id);
                            return (
                              <div
                                key={node.id}
                                onClick={() => {
                                  const newSet = new Set(traceTargets);
                                  if (isSelected) newSet.delete(node.id);
                                  else newSet.add(node.id);
                                  setTraceTargets(newSet);
                                }}
                                className={`flex items-center gap-3 p-3 border cursor-pointer transition-all ${isSelected
                                  ? (theme === 'light' ? 'bg-blue-50 border-blue-300' : 'bg-blue-900/30 border-blue-700')
                                  : (theme === 'light' ? 'bg-white border-gray-200 hover:border-gray-400' : 'bg-black border-gray-800 hover:border-gray-600')
                                  }`}
                              >
                                <div className={`w-4 h-4 flex items-center justify-center border ${isSelected ? 'bg-blue-500 border-blue-600' : 'border-gray-400'}`}>
                                  {isSelected && <Check size={12} className="text-white" />}
                                </div>
                                <div className="overflow-hidden">
                                  <div className={`font-mono text-xs font-bold truncate ${textMain}`}>{node.id}</div>
                                  <div className="text-[9px] text-gray-400 flex items-center gap-2">
                                    <span>Bal: {formatNumber(node.balance)}</span>
                                    {node.type !== 'wallet' && <span className="uppercase text-orange-500">[{node.type}]</span>}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-4 mt-2 border-t-2 border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <div className="text-xs font-bold text-gray-500">
                  Total Selected: <span className="text-blue-600">{traceTargets.size}</span>
                </div>
                <button
                  onClick={() => setShowSelectionModal(false)}
                  className={`px-6 py-2 bg-black text-white font-black uppercase tracking-widest border-2 ${theme === 'light' ? 'border-transparent' : 'border-white'} hover:scale-105 transition-transform`}
                >
                  Confirm Selection
                </button>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNodeList && (
          <MotionDiv initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} className={`absolute top-16 right-4 w-80 max-h-[calc(100vh-100px)] flex flex-col z-20 border-4 ${panelBorder} ${panelBg} neo-shadow-lg shadow-2xl`}>
            <div className={`p-3 border-b-2 ${panelBorder} flex justify-between items-center ${theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'}`}>
              <h3 className="font-black uppercase text-sm tracking-wider flex items-center gap-2"><Users size={14} /> Participants</h3>
              <button onClick={() => setShowNodeList(false)} className="hover:text-red-400"><X size={14} /></button>
            </div>
            <div className={`p-2 border-b-2 ${panelBorder} ${theme === 'light' ? 'bg-gray-50' : 'bg-[#151515]'}`}>
              <div className={`flex items-center gap-2 px-2 py-1.5 border-2 ${panelBorder} ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
                <Search size={14} className="opacity-50" />
                <input className={`w-full bg-transparent outline-none text-xs font-mono font-bold ${textMain}`} placeholder="Filter address..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {nodes.filter(n => n.id.toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => b.balance - a.balance).map((node, idx) => (
                <div key={node.id} onClick={() => setSelectedNode(node)} className={`p-3 border-b ${theme === 'light' ? 'border-gray-200 hover:bg-gray-50' : 'border-gray-800 hover:bg-gray-900'} cursor-pointer flex justify-between items-center group transition-colors`}>
                  <div className="flex items-center gap-3">
                    {baseAddresses.has(node.id.toLowerCase()) ? (
                      <div className="w-6 h-6 rounded-full bg-red-500 border border-white shadow-sm flex items-center justify-center text-[10px] font-black text-white">0</div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-black/10 shadow-sm flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: node.groupColor }}>
                        {node.hop !== undefined ? node.hop : '-'}
                      </div>
                    )}
                    <div>
                      <div className={`text-xs font-bold font-mono group-hover:text-blue-500 ${textMain}`}>{truncate(node.id)}</div>
                      <div className={`text-[10px] font-medium ${textSub}`}>{node.type.toUpperCase()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-black ${textMain}`}>{formatNumber(node.balance)}</div>
                    <div className="text-[9px] text-gray-400">{activeType === 'native' ? 'ETH' : 'TKN'}</div>
                  </div>
                </div>
              ))}
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {filtersOpen && (
          <MotionDiv drag dragControls={controlsDragControls} dragMomentum={false} initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} className={`absolute top-20 left-4 w-72 ${panelBg} border-4 ${panelBorder} neo-shadow-lg z-20 flex flex-col max-h-[calc(100vh-100px)]`}>
            <div onPointerDown={(e) => controlsDragControls.start(e)} className={`p-3 border-b-4 ${panelBorder} ${theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'} cursor-move flex justify-between items-center shrink-0`}>
              <h3 className="font-black uppercase text-sm tracking-wider flex items-center gap-2"><Filter size={14} /> Controls</h3>
              <button onClick={() => setFiltersOpen(false)} onPointerDown={(e) => e.stopPropagation()}><X size={14} /></button>
            </div>
            <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {availableTokens.length > 0 && (
                <div className={`p-3 border-2 ${panelBorder} ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <label className={`text-xs font-black uppercase flex items-center gap-1 ${textMain}`}><Coins size={12} /> Tokens</label>
                    <button onClick={toggleAllTokens} className="text-[10px] underline font-bold text-blue-500 hover:text-blue-600">{selectedTokens.size === availableTokens.length ? 'None' : 'All'}</button>
                  </div>
                  <div className={`max-h-32 overflow-y-auto custom-scrollbar border p-1 space-y-1 ${theme === 'light' ? 'bg-white border-gray-300' : 'bg-black border-gray-700'}`}>
                    {availableTokens.map(token => (
                      <div key={token} className={`flex items-center justify-between p-1.5 transition-colors group/token ${theme === 'light' ? 'hover:bg-blue-50' : 'hover:bg-blue-900/20'}`}>
                        <div onClick={() => toggleToken(token)} className={`flex items-center gap-2 cursor-pointer text-xs font-mono font-bold ${theme === 'light' ? 'text-slate-900' : 'text-gray-200'}`}>
                          {selectedTokens.has(token) ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} className="text-gray-400" />}
                          {token}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete ALL "${token}" transactions?`)) {
                              onDeleteToken(token);
                            }
                          }}
                          className="opacity-0 group-hover/token:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                          title="Delete all transactions for this token"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className={`text-xs font-black uppercase mb-2 block ${textSub}`}>Time Range</label>
                <div className="space-y-2">
                  <input type="date" className={`w-full p-2 border-2 ${panelBorder} text-xs font-bold ${theme === 'light' ? 'bg-gray-50' : 'bg-black text-white'}`} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value ? new Date(e.target.value) : null }))} />
                  <input type="date" className={`w-full p-2 border-2 ${panelBorder} text-xs font-bold ${theme === 'light' ? 'bg-gray-50' : 'bg-black text-white'}`} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value ? new Date(e.target.value) : null }))} />
                </div>
              </div>
              <div>
                <label className={`text-xs font-black uppercase mb-2 block ${textSub}`}>Min Value (Dust)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className={`w-full p-2 border-2 ${panelBorder} font-mono font-bold text-xs ${theme === 'light' ? 'bg-white' : 'bg-black text-white'} focus:outline-none focus:ring-2 focus:ring-red-500 transition-all`}
                    value={dustThreshold}
                    onChange={(e) => setDustThreshold(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="0.00"
                  />
                  <AnimatePresence>
                    {dustThreshold !== '' && dustThreshold > 0 && (
                      <MotionDiv
                        initial={{ scale: 0, width: 0, opacity: 0 }}
                        animate={{ scale: 1, width: 'auto', opacity: 1 }}
                        exit={{ scale: 0, width: 0, opacity: 0 }}
                        className="shrink-0"
                      >
                        <button
                          onClick={handleDeleteDustWrapper}
                          disabled={isDeletingDust}
                          className={`h-full px-3 bg-red-500 hover:bg-red-600 text-white border-2 ${panelBorder} transition-colors flex items-center justify-center neo-shadow-hover`}
                          title="Delete transactions below this value"
                        >
                          {isDeletingDust ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </MotionDiv>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 italic">
                  {isDeletingDust ? "Deleting dust..." : "Enter value to filter. Click bin to delete."}
                </p>
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedNode && selectedStats && (
          <MotionDiv initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }} className={`absolute top-0 right-0 h-full w-[400px] ${panelBg} border-l-4 ${panelBorder} neo-shadow-lg z-40 flex flex-col shadow-2xl`}>
            <div className={`p-6 border-b-4 ${panelBorder} ${theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'} flex justify-between items-start`}>
              <div className="w-full overflow-hidden">
                <h2 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">Node Inspector</h2>
                <div onClick={() => handleCopyAddress(selectedNode.id)} className="group relative cursor-pointer active:scale-[0.99] transition-transform w-full" title="Click to copy address">
                  <div className={`font-mono text-xl font-black break-all leading-tight ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'} group-hover:text-blue-500 transition-colors`}>{selectedNode.id}</div>
                  <div className="flex items-center gap-2 mt-2">
                    {copyFeedback ? <span className="text-green-400 font-black animate-pulse flex items-center gap-1 text-xs"><Check size={12} /> COPIED!</span> : <span className="text-gray-400 font-bold text-[10px] flex items-center gap-1 group-hover:text-blue-500"><Copy size={10} /> CLICK TO COPY</span>}
                    {baseAddresses.has(selectedNode.id.toLowerCase()) && <span className="text-red-500 font-black text-[10px] bg-red-100 px-1 rounded border border-red-200 ml-2">BASE (0)</span>}
                    {selectedNode.hop !== undefined && selectedNode.hop > 0 && <span className="text-blue-500 font-black text-[10px] bg-blue-100 px-1 rounded border border-blue-200 ml-2">HOP {selectedNode.hop}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedNode(null)} className="hover:rotate-90 transition-transform ml-4 text-white mix-blend-difference"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 border-2 ${panelBorder} ${theme === 'light' ? 'bg-blue-50' : 'bg-blue-900/20'}`}>
                  <div className="text-[10px] font-black uppercase text-blue-500 mb-1">Total Sent</div>
                  <div className={`text-xl font-black ${textMain}`}>{formatNumber(selectedStats.sentVal)}</div>
                  <div className="text-xs font-mono flex items-center gap-1 mt-1 opacity-50"><ArrowUpRight size={10} /> Outflow</div>
                </div>
                <div className={`p-4 border-2 ${panelBorder} ${theme === 'light' ? 'bg-green-50' : 'bg-green-900/20'}`}>
                  <div className="text-[10px] font-black uppercase text-green-500 mb-1">Total Received</div>
                  <div className={`text-xl font-black ${textMain}`}>{formatNumber(selectedStats.receivedVal)}</div>
                  <div className="text-xs font-mono flex items-center gap-1 mt-1 opacity-50"><ArrowDownLeft size={10} /> Inflow</div>
                </div>
              </div>
              <div className={`border-2 ${panelBorder} ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
                <div className={`p-3 border-b-2 ${panelBorder} ${theme === 'light' ? 'bg-gray-100' : 'bg-gray-900'} flex justify-between items-center`}>
                  <h3 className={`font-black uppercase text-xs ${textMain}`}>Transaction Log</h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'}`}>{selectedStats.totalCount}</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className={`sticky top-0 ${theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'} text-[10px] uppercase font-bold ${textSub}`}><tr><th className="p-2 border-b">Type</th><th className="p-2 border-b">Amount</th><th className="p-2 border-b">To/From</th><th className="p-2 border-b">Age</th></tr></thead>
                    <tbody className="font-mono text-[10px]">
                      {selectedStats.history.map(tx => {
                        const isSent = tx.from === selectedNode.id;
                        return (
                          <tr key={tx.id} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-gray-800'}`}>
                            <td className="p-2"><span className={`px-1.5 py-0.5 rounded border ${isSent ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{isSent ? 'OUT' : 'IN'}</span></td>
                            <td className={`p-2 font-bold ${textMain}`}>{formatNumber(tx.value)}</td>
                            <td className={`p-2 ${textSub} truncate max-w-[80px]`} title={isSent ? tx.to : tx.from}>{truncate(isSent ? tx.to : tx.from)}</td>
                            <td className="p-2 text-gray-400">{getAge(tx.timestamp)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BubbleViz;