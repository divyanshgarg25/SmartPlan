import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function TimePickerButton({ value, onChange, icon: Icon, placeholder = "Time" }) {
  const [open, setOpen] = useState(false);

  // value is expected to be "HH:mm" (24h format)
  const currentHour = value ? value.split(":")[0] : "09";
  const currentMinute = value ? value.split(":")[1] : "00";

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));

  return (
    <>
      <div className="relative group flex items-center h-[42px] cursor-pointer">
        {Icon && <Icon size={16} className="absolute left-3 text-brand opacity-80 pointer-events-none transition-transform group-focus-within:scale-110 z-10" />}
        <button type="button" onClick={() => setOpen(true)}
                className="w-full h-full pl-9 pr-3 rounded-xl bg-bg-subtle/50 border border-transparent focus:border-brand/40 outline-none transition-all text-sm hover:bg-bg-subtle text-left flex items-center justify-between shadow-sm">
          <span className={`truncate ${value ? "text-ink font-medium" : "text-ink-muted/60"}`}>
            {value ? value.slice(0, 5) : placeholder}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-2 opacity-50"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/20 backdrop-blur-sm cursor-pointer" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }} className="relative bg-bg-card border border-border/60 rounded-[24px] shadow-2xl overflow-hidden w-full max-w-[300px]">
              
              <div className="flex items-center justify-between p-4 border-b border-border/40 bg-bg-subtle/30">
                <h3 className="font-display font-bold text-lg">Select Time</h3>
                <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-bg-subtle"><X size={18} /></button>
              </div>

              <div className="flex h-64">
                {/* Hours Column */}
                <div className="w-1/2 h-full overflow-y-auto border-r border-border/40 flex flex-col hide-scrollbar relative bg-bg-card">
                  <div className="text-[10px] text-center font-bold text-ink-muted/80 uppercase tracking-wider py-2 sticky top-0 bg-bg-card/95 backdrop-blur-md z-10 border-b border-border/40">Hour</div>
                  <div className="p-2 flex flex-col gap-1.5">
                    {hours.map(h => (
                      <button key={h} onClick={() => onChange(`${h}:${currentMinute}`)}
                              className={`py-2.5 text-sm rounded-xl transition-all ${h === currentHour ? 'bg-brand text-brand-fg font-bold shadow-md' : 'hover:bg-bg-subtle text-ink font-medium'}`}>
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Minutes Column */}
                <div className="w-1/2 h-full overflow-y-auto flex flex-col hide-scrollbar relative bg-bg-card">
                  <div className="text-[10px] text-center font-bold text-ink-muted/80 uppercase tracking-wider py-2 sticky top-0 bg-bg-card/95 backdrop-blur-md z-10 border-b border-border/40">Min</div>
                  <div className="p-2 flex flex-col gap-1.5">
                    {minutes.map(m => (
                      <button key={m} onClick={() => { onChange(`${currentHour}:${m}`); setOpen(false); }}
                              className={`py-2.5 text-sm rounded-xl transition-all ${m === currentMinute ? 'bg-brand text-brand-fg font-bold shadow-md' : 'hover:bg-bg-subtle text-ink font-medium'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export function DateTimePickerButton({ value, onChange, icon: Icon, placeholder = "Select Date & Time" }) {
  const [open, setOpen] = useState(false);
  const dateObj = value ? new Date(value) : new Date();
  
  const [currentMonth, setCurrentMonth] = useState(dateObj.getMonth());
  const [currentYear, setCurrentYear] = useState(dateObj.getFullYear());

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const handleDayClick = (day) => {
    const newDate = new Date(currentYear, currentMonth, day, dateObj.getHours(), dateObj.getMinutes());
    const offset = newDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(newDate - offset)).toISOString().slice(0, 16);
    onChange(localISOTime);
  };

  const handleTimeChange = (type, val) => {
    const newDate = new Date(value || new Date());
    if (type === 'h') newDate.setHours(parseInt(val, 10));
    if (type === 'm') newDate.setMinutes(parseInt(val, 10));
    const offset = newDate.getTimezoneOffset() * 60000;
    onChange((new Date(newDate - offset)).toISOString().slice(0, 16));
  };

  const currentHour = (value ? dateObj.getHours() : 0).toString().padStart(2, "0");
  const currentMinute = (value ? dateObj.getMinutes() : 0).toString().padStart(2, "0");
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"));
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <>
      <div className="relative group flex items-center h-[42px] cursor-pointer">
        {Icon && <Icon size={16} className="absolute left-3 text-brand opacity-80 pointer-events-none transition-transform group-focus-within:scale-110 z-10" />}
        <button type="button" onClick={() => setOpen(true)}
                className="w-full h-full pl-9 pr-3 rounded-xl bg-bg-subtle/50 border border-transparent focus:border-brand/40 outline-none transition-all text-sm hover:bg-bg-subtle text-left flex items-center justify-between shadow-sm">
          <span className={`truncate ${value ? "text-ink font-medium" : "text-ink-muted/60"}`}>
            {value ? dateObj.toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : placeholder}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-2 opacity-50"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/20 backdrop-blur-sm cursor-pointer" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }} className="relative bg-bg-card border border-border/60 rounded-[24px] shadow-2xl overflow-hidden w-full max-w-[340px]">
              
              <div className="flex items-center justify-between p-4 border-b border-border/40 bg-bg-subtle/30">
                <button type="button" onClick={() => { if(currentMonth===0){setCurrentMonth(11);setCurrentYear(currentYear-1)}else setCurrentMonth(currentMonth-1) }} className="p-2 rounded-xl hover:bg-bg-subtle text-ink shadow-sm bg-bg-card"><ChevronLeft size={18} /></button>
                <div className="text-base font-bold text-ink font-display">{monthNames[currentMonth]} {currentYear}</div>
                <button type="button" onClick={() => { if(currentMonth===11){setCurrentMonth(0);setCurrentYear(currentYear+1)}else setCurrentMonth(currentMonth+1) }} className="p-2 rounded-xl hover:bg-bg-subtle text-ink shadow-sm bg-bg-card"><ChevronRight size={18} /></button>
              </div>
              
              <div className="p-4 bg-bg-card">
                <div className="grid grid-cols-7 mb-3">
                  {dayNames.map(d => <div key={d} className="text-[11px] text-center font-bold text-ink-muted uppercase">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isSelected = value && dateObj.getDate() === day && dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear;
                    const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
                    return (
                      <button key={day} type="button" onClick={() => handleDayClick(day)}
                              className={`aspect-square w-full rounded-full text-xs font-bold flex items-center justify-center transition-all 
                                ${isSelected ? 'bg-brand text-brand-fg shadow-lg scale-110' : 
                                  isToday ? 'border-2 border-brand text-brand' : 
                                  'text-ink hover:bg-bg-subtle hover:scale-105'}`}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {value && (
                <div className="border-t border-border/40 bg-bg-subtle/50 flex flex-col">
                  <div className="flex h-44 border-b border-border/40">
                    <div className="w-1/2 h-full overflow-y-auto border-r border-border/40 flex flex-col hide-scrollbar relative bg-bg-card">
                      <div className="text-[10px] text-center font-bold text-ink-muted/80 uppercase tracking-wider py-1.5 sticky top-0 bg-bg-card/95 backdrop-blur-md z-10 border-b border-border/40">Hour</div>
                      <div className="p-1.5 flex flex-col gap-1">
                        {hours.map(h => (
                          <button key={h} onClick={() => handleTimeChange('h', h)}
                                  className={`py-2 text-sm rounded-lg transition-all ${h === currentHour ? 'bg-brand text-brand-fg font-bold shadow-md' : 'hover:bg-bg-subtle text-ink font-medium'}`}>
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="w-1/2 h-full overflow-y-auto flex flex-col hide-scrollbar relative bg-bg-card">
                      <div className="text-[10px] text-center font-bold text-ink-muted/80 uppercase tracking-wider py-1.5 sticky top-0 bg-bg-card/95 backdrop-blur-md z-10 border-b border-border/40">Min</div>
                      <div className="p-1.5 flex flex-col gap-1">
                        {minutes.map(m => (
                          <button key={m} onClick={() => handleTimeChange('m', m)}
                                  className={`py-2 text-sm rounded-lg transition-all ${m === currentMinute ? 'bg-brand text-brand-fg font-bold shadow-md' : 'hover:bg-bg-subtle text-ink font-medium'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <button type="button" onClick={() => setOpen(false)}
                            className="w-full py-2.5 bg-brand text-brand-fg text-sm font-bold rounded-xl hover:brightness-110 shadow-md transition-all flex items-center justify-center gap-2">
                      Complete Selection
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
