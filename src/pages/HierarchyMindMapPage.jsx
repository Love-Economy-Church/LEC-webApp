import { IonPage, IonContent } from '@ionic/react';
import { useEffect, useCallback, useState, useMemo } from 'react';
import { useWindowSize } from '../hooks/useWindowSize';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    Background,
    MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';

import { createUnit, fetchHierarchyData } from '../services/hierarchyService';
import { cacheService } from '../services/cacheService';
import { useAuth } from '../contexts/AuthContext';

import CollapsibleNode from '../components/CollapsibleNode';
import NodeDetailsPanel from '../components/NodeDetailsPanel';
import ImageModal from '../components/common/ImageModal';
import AddUnitModal from '../components/AddUnitModal';
import PersonProfileModal from '../components/PersonProfileModal';
import MindMapSearch from '../components/mindmap/MindMapSearch';
import { layoutTree, getStyle } from '../utils/mindmapLayoutUtils';

const nodeTypes = {
    mindMapNode: CollapsibleNode
};

export default function HierarchyMindMapPage() {
    const { width } = useWindowSize();
    const isMobile = width < 768;
    const { user, userRole, getManagedUnits } = useAuth();
    
    // Core Data State
    const [flatData, setFlatData] = useState([]);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [collapsedIds, setCollapsedIds] = useState(new Set());
    const [rfInstance, setRfInstance] = useState(null);
    
    // RBAC
    const [managedUnitIds, setManagedUnitIds] = useState(new Set());
    const [isAllManaged, setIsAllManaged] = useState(false);

    // UI State
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    
    // Modals
    const [modalConfig, setModalConfig] = useState({ isOpen: false, src: '', title: '' });
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [targetParent, setTargetParent] = useState(null);
    const [personProfileData, setPersonProfileData] = useState(null);

    const handleToggle = useCallback((nodeId) => {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    }, []);

    const onNodeClick = useCallback((event, node) => setSelectedNodeId(node.id), []);
    const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

    const handleSearchResultClick = useCallback((result) => {
        const node = nodes.find(n => n.id === result.id);
        if (node && rfInstance) {
            setSelectedNodeId(result.id);
            rfInstance.setCenter(node.position.x, node.position.y, { zoom: 1.2, duration: 800 });
            setSearchQuery('');
            setSearchResults([]);
        }
    }, [nodes, rfInstance]);

    const refreshData = useCallback(async () => {
        cacheService.clear(); 
        
        let allowed = new Set();
        let allManaged = false;
        
        if (userRole) {
            try {
                const result = await getManagedUnits();
                if (result === 'ALL') allManaged = true;
                else allowed = result;
            } catch(e) {
                console.error("Failed to load managed units:", e);
            }
        }
        
        setIsAllManaged(allManaged);
        setManagedUnitIds(allowed);

        fetchHierarchyData().then(units => {
            let filteredUnits = units;
            // RBAC: If logged in & not global admin, only show managed units
            if (user && !allManaged) {
                filteredUnits = units.filter(u => allowed.has(u.id));
            }

            const hierarchyNodes = filteredUnits.map(unit => ({
                id: unit.id,
                name: unit.name,
                unit_type: unit.unit_type,
                parent_id: unit.parent_id,
                leaders: unit.leaders || [],
                members: unit.members || []
            }));

            // INJECT PERSON NODES FOR EVERY CELL (so members and shepherds are displayed as leaves of the cells in the mindmap)
            const peopleNodes = [];
            hierarchyNodes.forEach(unit => {
                if (unit.unit_type === 'CELL') {
                    const cellPeople = [...(unit.leaders || []), ...(unit.members || [])];
                    cellPeople.forEach(p => {
                        peopleNodes.push({
                            id: `person-${p.id}`,
                            name: p.name,
                            unit_type: 'PERSON',
                            parent_id: unit.id,
                            photo: p.photo,
                            role: p.role || 'Member',
                            unitName: unit.name,
                            isPlaceholder: p.isPlaceholder
                        });
                    });
                }
            });
            hierarchyNodes.push(...peopleNodes);

            // Collapse MC, BUSCENTA, and CELL levels by default on initial load to avoid bulkiness
            const initialCollapsed = new Set();
            hierarchyNodes.forEach(unit => {
                if (unit.unit_type === 'MC' || unit.unit_type === 'BUSCENTA' || unit.unit_type === 'CELL') {
                    initialCollapsed.add(unit.id);
                }
            });
            setCollapsedIds(initialCollapsed);

            setFlatData(hierarchyNodes);
        });
    }, [user, userRole, getManagedUnits]);

    useEffect(() => { refreshData(); }, [refreshData]);

    const handleAddChild = useCallback((parentNode) => {
        setTargetParent(parentNode);
        setIsUnitModalOpen(true);
    }, []);

    const onSubmitUnit = async (data) => {
        try {
            await createUnit({
                name: data.name,
                unit_type: data.unit_type,
                parent_id: data.parent_id,
                order_index: 0
            });
            setIsUnitModalOpen(false);
            refreshData();
        } catch (error) {
            console.error('Failed to create unit:', error);
        }
    };

    // Apply Layout
    useEffect(() => {
        if (flatData.length === 0) return;

        const layout = layoutTree(flatData, collapsedIds, userRole);

        const mapResultIds = searchResults.map(r => r.id);

        const activeNodes = layout.nodes.map(n => ({
            ...n,
            data: {
                ...n.data,
                onToggle: handleToggle,
                onImageClick: (src, title) => setModalConfig({ isOpen: true, src, title })
            },
            style: {
                ...getStyle(n.data.unit_type, n.id === selectedNodeId, n.data.role),
                opacity: (searchResults.length > 0 && !mapResultIds.includes(n.id) && !selectedNodeId) ? 0.3 : 1
            }
        }));

        const activeEdges = layout.edges.map(e => ({
            ...e,
            style: {
                stroke: (selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId)) ? '#6366f1' : '#475569',
                strokeWidth: (selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId)) ? 3 : 1.5,
                opacity: (searchResults.length > 0 && !mapResultIds.includes(e.source) && !mapResultIds.includes(e.target) && !selectedNodeId) ? 0.3 : 1
            },
            animated: selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId)
        }));

        setNodes(activeNodes);
        setEdges(activeEdges);

    }, [flatData, collapsedIds, handleToggle, selectedNodeId, searchResults, setNodes, setEdges]);

    const selectedNodeData = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

    return (
        // <IonPage>
            // <IonContent className="ion-padding-bottom bg-[#000000]">
                <div 
                    className="w-full bg-slate-900/40 relative overflow-hidden rounded-3xl border border-slate-700/50 shadow-2xl"
            style={{ height: 'calc(100dvh - 220px)', minHeight: '500px' }}
        >
            <div className="absolute inset-0 bg-dot-pattern bg-dot-md text-church-blue-500 opacity-[0.03] pointer-events-none z-0" />

            {/* Extracted Search Component */}
            <MindMapSearch 
                flatData={flatData}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                setSearchResults={setSearchResults}
                onResultClick={handleSearchResultClick}
            />

            {/* Extracted Details Panel */}
            {selectedNodeData && (
                <div className="absolute right-0 top-0 bottom-0 z-50 pointer-events-none flex flex-col justify-center pr-6">
                    <div className="pointer-events-auto h-auto">
                        <NodeDetailsPanel
                            node={selectedNodeData}
                            onClose={() => setSelectedNodeId(null)}
                            onAddChild={handleAddChild}
                            onViewPersonDetails={setPersonProfileData}
                        />
                    </div>
                </div>
            )}

            <AddUnitModal
                isOpen={isUnitModalOpen}
                onClose={() => setIsUnitModalOpen(false)}
                parentNode={targetParent}
                onSubmit={onSubmitUnit}
            />

            <ReactFlow
                onInit={setRfInstance}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
                minZoom={0.1}
                edgesFocusable={false}
                edgesUpdatable={false}
                nodesDraggable={false}
            >
                <Controls className="!bg-black/80 !text-gray-300 !border !border-gray-700 !rounded-xl !left-4 !bottom-4" />
                {!isMobile && (
                    <MiniMap
                        nodeColor={(n) => {
                            if (n.data.unit_type === 'PERSON') return '#1a1a1a';
                            if (n.id === selectedNodeId) return '#3385FF';
                            return '#0066FF';
                        }}
                        maskColor="rgba(0, 0, 0, 0.85)"
                        className="!bg-black/80 !border !border-gray-700 !rounded-xl !bottom-4 !right-4"
                    />
                )}
                <Background color="#1a1a1a" gap={30} size={1} variant="dots" />
            </ReactFlow>

            {/* Utility Modals */}
            <ImageModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                imageSrc={modalConfig.src}
                title={modalConfig.title}
            />

            <PersonProfileModal
                isOpen={!!personProfileData}
                onClose={() => setPersonProfileData(null)}
                person={personProfileData}
            />
        </div>
            // </IonContent>
        // </IonPage>
    );
}
