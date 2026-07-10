import { useEffect } from 'react';
import { Search, ChevronRight } from 'lucide-react';

export default function MindMapSearch({ flatData = [], searchQuery, setSearchQuery, searchResults, setSearchResults, onResultClick }) {
    
    useEffect(() => {
        if (!searchQuery.trim() || flatData.length === 0) {
            setSearchResults([]);
            return;
        }

        const q = searchQuery.toLowerCase();
        const results = [];
        
        flatData.forEach(d => {
            if (d.name.toLowerCase().includes(q) || (d.leaders && d.leaders.some(l => l.name.toLowerCase().includes(q)))) {
                results.push({ id: d.id, name: d.name, type: d.unit_type });
            }
            if (d.members) {
                const matchingMembers = d.members.filter(m => m.name.toLowerCase().includes(q));
                matchingMembers.forEach(m => {
                    // For injected PERSON nodes, d.id is already person-xxx. 
                    // For Units, d.id will point to the Unit so the map can center correctly.
                    results.push({ id: d.id, name: m.name, type: 'PERSON (Member)', unitName: d.name });
                });
            }
        });

        setSearchResults(results.slice(0, 10));
    }, [searchQuery, flatData, setSearchResults]);

    const handleResultClick = (result) => {
        if (onResultClick) {
            onResultClick(result);
        }
    };

    return (
        <div className="absolute top-4 left-4 z-50 w-[calc(100%-2rem)] md:w-80">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-church-blue-400 transition-colors" size={18} />
                <input
                    type="text"
                    placeholder="Search map..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-church-blue-500/50 focus:ring-2 focus:ring-church-blue-500/50 shadow-lg text-slate-200 font-medium"
                />

                {searchQuery && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur border border-slate-700/50 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                        {searchResults.map((result, idx) => (
                            <div
                                key={`${result.id}-${idx}`}
                                onClick={() => handleResultClick(result)}
                                className="px-4 py-3 hover:bg-slate-800/50 cursor-pointer border-b border-slate-800/50 last:border-0 flex items-center justify-between group flex-shrink-0"
                            >
                                <div>
                                    <p className="text-sm font-bold text-slate-200 group-hover:text-white">{result.name}</p>
                                    <p className="text-xs text-slate-500">
                                        {result.type}
                                        {result.unitName && ` • ${result.unitName}`}
                                    </p>
                                </div>
                                <ChevronRight size={14} className="text-slate-600 group-hover:text-church-blue-400 shrink-0" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
