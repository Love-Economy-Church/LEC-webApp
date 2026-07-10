import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const CollapsibleNode = memo(({ data, isConnectable, style }) => {
    // data.isCollapsed, data.hasChildren, data.onToggle
    // Using node styles passed from parent

    const activeLeaderCount = data.leaders?.length || 0;
    const isPerson = data.unit_type === 'PERSON';

    return (
        <div style={style} className={`relative group min-h-[60px] flex flex-col justify-center ${isPerson ? 'items-center' : ''}`}>
            {/* Input Handle (Left) */}
            <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="opacity-0" />

            {isPerson ? (
                <div className="flex flex-col items-center justify-center min-h-[40px]">
                    <span className="font-semibold text-sm text-center">{data.label}</span>
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/10 w-full justify-center">
                        <div 
                            onClick={(e) => {
                                e.stopPropagation();
                                data.photo && data.onImageClick && data.onImageClick(data.photo, data.label);
                            }}
                            className={`w-5 h-5 rounded-full overflow-hidden border border-church-blue-500/30 shrink-0 bg-slate-800 flex items-center justify-center ${data.photo ? 'cursor-pointer' : ''}`}
                        >
                            {data.photo ? (
                                <img src={data.photo} alt={data.label} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xs font-bold text-church-blue-400">{data.label?.charAt(0)}</span>
                            )}
                        </div>
                        <span className="text-[10px] text-church-blue-300 font-bold uppercase tracking-wider truncate max-w-[100px]">
                            {data.role || 'Member'}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center min-h-[40px]">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                        {data.unit_type}
                    </span>
                    <span className="font-semibold text-sm">{data.label}</span>
                    {(() => {
                        // For CELL: ONLY show as leader if they have the exact 'cell shepherd' role in DB
                        const primaryLeader = data.unit_type === 'CELL'
                            ? (data.leaders?.find(l => l.role?.toLowerCase() === 'cell shepherd') || null)
                            : data.leaders?.[0];
                        return primaryLeader && (
                            <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/10 w-full justify-center">
                                {primaryLeader.photo && (
                                    <div 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            data.onImageClick && data.onImageClick(primaryLeader.photo, primaryLeader.name);
                                        }}
                                        className="w-5 h-5 rounded-full overflow-hidden border border-church-blue-500/30 cursor-pointer"
                                    >
                                        <img src={primaryLeader.photo} alt="" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <span className="text-xs text-church-blue-300 font-medium truncate max-w-[150px]">
                                    {primaryLeader.name}
                                </span>
                                {activeLeaderCount > 1 && (
                                    <span className="text-[10px] bg-slate-700 px-1.5 rounded-full text-slate-300">
                                        +{activeLeaderCount - 1}
                                    </span>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Output Handle (Right) */}
            <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="opacity-0" />

            {/* Expand/Collapse Button */}
            {data.hasChildren && (
                <div
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-800/90 backdrop-blur-md border border-white/10 hover:border-church-blue-400/50 rounded-full flex items-center justify-center cursor-pointer transition-all z-50 text-white shadow-lg"
                    onClick={(e) => {
                        e.stopPropagation();
                        data.onToggle(data.id);
                    }}
                >
                    <ChevronRight
                        size={14}
                        className={`transition-transform duration-200 ${!data.isCollapsed ? 'rotate-90' : ''}`}
                    />
                </div>
            )}
        </div>
    );
});

export default CollapsibleNode;
