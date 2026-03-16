document.addEventListener('DOMContentLoaded', () => {
    const namesInput = document.getElementById('names-input'); // (pokud je ještě někde, ale máme nový DOM container)
    const statusBar = document.getElementById('status-bar');
    const spinBtn = document.getElementById('spin-btn');
    const winnerDisplay = document.getElementById('winner-display');
    const winnerNameEl = document.getElementById('winner-name');
    const winnerLabelEl = document.getElementById('winner-label');
    const controlsSection = document.querySelector('.controls-section');
    const bigWinOverlay = document.getElementById('big-win-overlay');
    
    // Nový kontejner pro správu jmen (nahrazení textarea pro možnost vyškrtávání)
    const namesContainer = document.getElementById('names-container');
    
    // Válce
    const scrollers = [
        document.getElementById('scroller-1'),
        document.getElementById('scroller-2'),
        document.getElementById('scroller-3')
    ];
    
    const ITEM_HEIGHT = 150; 
    const WILD_SYMBOL = "WILD";
    let isSpinning = false;
    
    const winLines = {
        'line-r1': document.getElementById('line-r1'),
        'line-r2': document.getElementById('line-r2'),
        'line-r3': document.getElementById('line-r3'),
        'line-d1': document.getElementById('line-d1'),
        'line-d2': document.getElementById('line-d2')
    };
    
    // --- WEB AUDIO API ZVUKY ---
    let audioCtx = null;
    let spinInterval = null;
    
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }
    
    function playTickSound() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100 + Math.random() * 20, audioCtx.currentTime); // Hrubší mechanický zvuk 
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime); // Tišší šum na pozadí
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    }
    
    function playReelStopSound() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }

    updateStatusCount();
    namesContainer.addEventListener('input', updateStatusCount);

    // Dvojklik na položku přepne její zaškrtnutí (vyřazení/vrácení)
    namesContainer.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('name-item')) {
            e.target.classList.toggle('strike-through');
            // Zabráníme označení textu při dvojkliku
            window.getSelection().removeAllRanges();
            updateStatusCount();
        }
    });

    function cleanName(n) {
        return n.trim();
    }

    // Zavření Big Win obrazovky kliknutím
    bigWinOverlay.addEventListener('click', () => {
        bigWinOverlay.classList.remove('active');
        setTimeout(() => bigWinOverlay.classList.add('hidden'), 500); // Nechat dohrát opacity transition
    });

    function getNames() {
        // Vrátíme seznam jen těch jmen, která NEJSOU přeškrtnutá (vyřazená)
        const nameItems = namesContainer.querySelectorAll('.name-item');
        const activeNames = [];
        nameItems.forEach(item => {
            if (!item.classList.contains('strike-through')) {
                const name = cleanName(item.textContent);
                if (name.length > 0) activeNames.push(name);
            }
        });
        return activeNames;
    }

    function getAllNames() {
        // Vrátíme všechny, včetně přeškrtnutých (slouží pro UI kontrolu)
        const nameItems = namesContainer.querySelectorAll('.name-item');
        return Array.from(nameItems).map(item => cleanName(item.textContent)).filter(n => n.length > 0);
    }

    // Pro event listenery na editaci textu (vytvořeno dynamicky výše)


    function updateStatusCount() {
        const totalCount = getAllNames().length;
        const activeCount = getNames().length;
        
        if (activeCount === 16 && totalCount === 16) {
            statusBar.textContent = `Perfektní, načteno ${activeCount} hrajících jmen.`;
            statusBar.style.color = '#f9d342'; 
        } else {
            statusBar.textContent = `Hraje ${activeCount} jmen (celkem ${totalCount})`;
            statusBar.style.color = activeCount < 16 ? '#a0a0b0' : '#ff3366'; 
        }
    }

    spinBtn.addEventListener('click', () => {
        if (isSpinning) return;
        
        const rawNames = getNames();
        if (rawNames.length === 0) {
            alert('Prosím, zadejte do seznamu nějaká jména.');
            return;
        }

        isSpinning = true;
        spinBtn.disabled = true;
        winnerDisplay.classList.add('hidden');
        winnerDisplay.classList.remove('success');
        
        // Před dalším točením skryjeme čáry
        Object.values(winLines).forEach(line => line.classList.remove('active'));

        const symbolsPool = [...rawNames, WILD_SYMBOL, WILD_SYMBOL, WILD_SYMBOL, WILD_SYMBOL]; // Víc wildů pro větší šanci na výhru v 3x3
        const forceWin = Math.random() < 0.35; // 35% šance
        
        // Zvuky Zapnout
        initAudio();
        if (spinInterval) clearInterval(spinInterval);
        spinInterval = setInterval(playTickSound, 60); // Cvakáme co 60ms, simuluje otáčení zubů válce
        
        let finalResults = [
            // válec 0-2: [řádek 0, 1, 2]
            [], [], []
        ];
        
        if (forceWin) {
            let winner = rawNames[Math.floor(Math.random() * rawNames.length)];
            const winLineIndex = Math.floor(Math.random() * 5); // 5 linií
            
            // Vyplníme mřížku náhodně
            for (let c = 0; c < 3; c++) {
                for (let r = 0; r < 3; r++) {
                    finalResults[c][r] = symbolsPool[Math.floor(Math.random() * symbolsPool.length)];
                }
            }
            
            const forceTripleWild = Math.random() < 0.15; // Triple Wild

            if (forceTripleWild) {
                // EXLUZIVNÍ VÝHRA - 3x WILD
                const placeWinSymbol = (col, row) => { finalResults[col][row] = WILD_SYMBOL; };

                if (winLineIndex === 0) { placeWinSymbol(0,0); placeWinSymbol(1,0); placeWinSymbol(2,0); }
                else if (winLineIndex === 1) { placeWinSymbol(0,1); placeWinSymbol(1,1); placeWinSymbol(2,1); }
                else if (winLineIndex === 2) { placeWinSymbol(0,2); placeWinSymbol(1,2); placeWinSymbol(2,2); }
                else if (winLineIndex === 3) { placeWinSymbol(0,0); placeWinSymbol(1,1); placeWinSymbol(2,2); }
                else if (winLineIndex === 4) { placeWinSymbol(0,2); placeWinSymbol(1,1); placeWinSymbol(2,0); }

            } else {
                // BĚŽNÁ VÝHRA NA LINII
                const placeWinSymbol = (col, row) => {
                    finalResults[col][row] = Math.random() < 0.2 ? WILD_SYMBOL : winner;
                };

                if (winLineIndex === 0) { placeWinSymbol(0,0); placeWinSymbol(1,0); placeWinSymbol(2,0); }
                else if (winLineIndex === 1) { placeWinSymbol(0,1); placeWinSymbol(1,1); placeWinSymbol(2,1); }
                else if (winLineIndex === 2) { placeWinSymbol(0,2); placeWinSymbol(1,2); placeWinSymbol(2,2); }
                else if (winLineIndex === 3) { placeWinSymbol(0,0); placeWinSymbol(1,1); placeWinSymbol(2,2); }
                else if (winLineIndex === 4) { placeWinSymbol(0,2); placeWinSymbol(1,1); placeWinSymbol(2,0); }

                // Pojistka, aby to nebyl čistý Triple Wild, který by ignoroval výherce
                let wildCount = 0;
                if (winLineIndex === 0) { if (finalResults[0][0]===WILD_SYMBOL) wildCount++; if(finalResults[1][0]===WILD_SYMBOL) wildCount++; if(finalResults[2][0]===WILD_SYMBOL) wildCount++; if (wildCount>=2) finalResults[2][0] = winner; }
                else if (winLineIndex === 1) { if (finalResults[0][1]===WILD_SYMBOL) wildCount++; if(finalResults[1][1]===WILD_SYMBOL) wildCount++; if(finalResults[2][1]===WILD_SYMBOL) wildCount++; if (wildCount>=2) finalResults[2][1] = winner; }
                else if (winLineIndex === 2) { if (finalResults[0][2]===WILD_SYMBOL) wildCount++; if(finalResults[1][2]===WILD_SYMBOL) wildCount++; if(finalResults[2][2]===WILD_SYMBOL) wildCount++; if (wildCount>=2) finalResults[2][2] = winner; }
                else if (winLineIndex === 3) { if (finalResults[0][0]===WILD_SYMBOL) wildCount++; if(finalResults[1][1]===WILD_SYMBOL) wildCount++; if(finalResults[2][2]===WILD_SYMBOL) wildCount++; if (wildCount>=2) finalResults[2][2] = winner; }
                else if (winLineIndex === 4) { if (finalResults[0][2]===WILD_SYMBOL) wildCount++; if(finalResults[1][1]===WILD_SYMBOL) wildCount++; if(finalResults[2][0]===WILD_SYMBOL) wildCount++; if (wildCount>=2) finalResults[2][0] = winner; }
            }

        } else {
            for (let c = 0; c < 3; c++) {
                for (let r = 0; r < 3; r++) {
                    finalResults[c][r] = symbolsPool[Math.floor(Math.random() * symbolsPool.length)];
                }
            }
        }

        // Nastavení parametrů pro točení
        // Každý válec se točí trochu déle (dramatický efekt)
        const baseSpinTime = 1500; // Zkráceno z 3000ms pro svižnější točení
        const addSpinTime = 500;   // Zkráceno z 1500ms pro svižnější točení
        
        // Budeme sbírat promises ze všech animací
        const spinPromises = [];

        finalResults.forEach((targetColSymbols, reelIndex) => {
            const scroller = scrollers[reelIndex];
            const duration = baseSpinTime + (reelIndex * addSpinTime);
            const rounds = 3 + reelIndex * 2; 
            
            scroller.innerHTML = '';
            const displaySymbols = [];
            
            // Když se scroller zastaví na pozici - (TargetIndex * ITEM_HEIGHT),
            // znamená to, že na vrcholu slot-window (row 0) bude prvek s tímto targetIndex.
            // Aby se zobrazily 3 symboly správně v pořadí:
            // row 0: displaySymbols[targetIndex]
            // row 1: displaySymbols[targetIndex + 1]
            // row 2: displaySymbols[targetIndex + 2]
            
            displaySymbols.push("TOČÍME");
            
            for (let i = 0; i < rounds; i++) {
                let shuffled = [...symbolsPool].sort(() => 0.5 - Math.random());
                displaySymbols.push(...shuffled);
            }
            
            // Cílové 3 položky (které budou vidět ve finále)
            // Pořadí zobrazení po zastavení (když se scroller zastaví na pozici -targetIndex * ITEM_HEIGHT):
            // viditelný řádek 0 (horní)  -> displaySymbols[targetIndex]
            // viditelný řádek 1 (střední)-> displaySymbols[targetIndex+1]
            // viditelný řádek 2 (dolní)  -> displaySymbols[targetIndex+2]
            
            displaySymbols.push(targetColSymbols[0]); // Půjde na targetIndex
            displaySymbols.push(targetColSymbols[1]); // Půjde na targetIndex + 1
            displaySymbols.push(targetColSymbols[2]); // Půjde na targetIndex + 2
            
            // Výplň na konec (pod poslední viditelný řádek), minimálně 2-3 prvky, ať to "nepřeteče" do prázdna
            displaySymbols.push(symbolsPool[Math.floor(Math.random() * symbolsPool.length)]);
            displaySymbols.push(symbolsPool[Math.floor(Math.random() * symbolsPool.length)]);

            // Render
            displaySymbols.forEach(sym => {
                const div = document.createElement('div');
                div.className = 'slot-item';
                if (sym === WILD_SYMBOL) div.classList.add('wild-symbol');
                div.textContent = sym;
                scroller.appendChild(div);
            });

            scroller.style.transition = 'none';
            scroller.style.transform = `translateY(0px)`;
            scroller.offsetHeight; // trigger reflow
            
            // targetIndex ukazuje na array pozici horního řádku
            // Máme na konci 3 cílové prvky a 2 výplně
            const targetIndex = displaySymbols.length - 5; 
            const targetY = -(targetIndex * ITEM_HEIGHT);
            
            scroller.style.transition = `transform ${duration}ms cubic-bezier(0.1, 0.9, 0.2, 1)`;
            scroller.style.transform = `translateY(${targetY}px)`;
            
            spinPromises.push(new Promise(res => {
                setTimeout(() => {
                    playReelStopSound(); // Cvak při dojezdu 
                    res();
                }, duration + 50);
            }));
        });

        // Jakmile se dotočí všechny válce:
        Promise.all(spinPromises).then(() => {
            if (spinInterval) clearInterval(spinInterval); // Poslední válec dotočil, utneme cvakání
            evaluateResult(finalResults, rawNames);
        });
    });

    function evaluateResult(finalResults, rawNames) {
        // finalResults je matice 3 slouce x 3 řádky (col, row)
        // Definice políček pro 5 linií:
        // Pamatuj: finalResults[col][row]
        const linesToCheck = [
            { id: 'line-r1', cells: [{c:0,r:0}, {c:1,r:0}, {c:2,r:0}] }, // Top row
            { id: 'line-r2', cells: [{c:0,r:1}, {c:1,r:1}, {c:2,r:1}] }, // Middle row
            { id: 'line-r3', cells: [{c:0,r:2}, {c:1,r:2}, {c:2,r:2}] }, // Bottom row
            { id: 'line-d1', cells: [{c:0,r:0}, {c:1,r:1}, {c:2,r:2}] }, // Diagonal Top-L to Bot-R
            { id: 'line-d2', cells: [{c:0,r:2}, {c:1,r:1}, {c:2,r:0}] }  // Diagonal Bot-L to Top-R
        ];

        let winningLines = []; 
        let winNamesSet = new Set(); 

        linesToCheck.forEach(lineDef => {
            const symbols = [
                finalResults[lineDef.cells[0].c][lineDef.cells[0].r],
                finalResults[lineDef.cells[1].c][lineDef.cells[1].r],
                finalResults[lineDef.cells[2].c][lineDef.cells[2].r]
            ];
            
            const nonWilds = symbols.filter(s => s !== WILD_SYMBOL);
            
            let isLineWin = false;
            let lineMatchName = null;

            if (nonWilds.length === 0) {
                lineMatchName = "Libovolný výběr";
                isLineWin = true;
            } else {
                const allSame = nonWilds.every(val => val === nonWilds[0]);
                if (allSame) {
                    lineMatchName = nonWilds[0];
                    isLineWin = true;
                }
            }

            if (isLineWin) {
                winningLines.push({
                    lineId: lineDef.id,
                    cells: lineDef.cells,
                    matchName: lineMatchName
                });
                
                if (lineMatchName !== "Libovolný výběr") {
                    winNamesSet.add(lineMatchName);
                }
            }
        });

        if (winningLines.length > 0) {
            // Animace výherních linií a WILD morphing
            winningLines.forEach(win => {
                // Zapneme SVG čáru
                if (winLines[win.lineId]) {
                    winLines[win.lineId].classList.add('active');
                }

                // Oživíme WILD symboly v této vítězné linii
                win.cells.forEach(cell => {
                    const symValue = finalResults[cell.c][cell.r];
                    if (symValue === WILD_SYMBOL && win.matchName !== "Libovolný výběr") {
                        const scroller = scrollers[cell.c];
                        const allItems = scroller.querySelectorAll('.slot-item');
                        // targetIndex byl `length - 5`. row=0 (idx: len-5), row=1 (idx: len-4), row=2 (idx: len-3)
                        const targetItemIndex = allItems.length - 5 + cell.r;
                        const targetEl = allItems[targetItemIndex];
                        
                        setTimeout(() => {
                            if (targetEl) {
                                targetEl.classList.add('wild-morph');
                                targetEl.textContent = win.matchName;
                                targetEl.style.color = 'var(--accent-primary)';
                            }
                        }, 400);
                    }
                });
            });

            // Oznámení
            setTimeout(() => {
                const uniqueNamesArray = Array.from(winNamesSet);
                let finalWinnerText = "";
                
                if (uniqueNamesArray.length === 0) {
                    // Byl to "Libovolný výběr" (čisté WILDy)
                    finalWinnerText = "Libovolný výběr";
                } else if (uniqueNamesArray.length === 1) {
                    finalWinnerText = uniqueNamesArray[0];
                } else {
                    finalWinnerText = uniqueNamesArray.join(' a ');
                }
                
                // Přeškrtnutí jmen v seznamu (vyřazení do další hry!)
                uniqueNamesArray.forEach(winName => {
                    const nameItems = namesContainer.querySelectorAll('.name-item');
                    nameItems.forEach(item => {
                        if (cleanName(item.textContent) === winName) {
                            item.classList.add('strike-through');
                        }
                    });
                });
                
                updateStatusCount(); // Aktualizace počítadla dole

                winnerLabelEl.textContent = `Výherních linií: ${winningLines.length}!`;
                winnerNameEl.textContent = finalWinnerText;
                winnerDisplay.classList.add('success');
                winnerDisplay.classList.remove('hidden');
                
                isSpinning = false;
                spinBtn.disabled = false;
                
                // --- BIG WIN KONTROLA ---
                if (finalWinnerText === "Libovolný výběr") {
                    setTimeout(() => {
                        bigWinOverlay.classList.remove('hidden');
                        // Vynutit DOM reflow
                        void bigWinOverlay.offsetWidth;
                        bigWinOverlay.classList.add('active');
                    }, 500); // Mírný delay pro napětí po oznámení dole
                }
                
            }, 1000);

        } else {
            // Prohra
            winnerLabelEl.textContent = "Zkuste to znovu:";
            winnerNameEl.textContent = "Nevýherní otočka";
            winnerDisplay.classList.remove('hidden');
            
            isSpinning = false;
            spinBtn.disabled = false;
        }
    }
});
