let onStartCallback =null;

document.getElementById('startButton').addEventListener('click',()=>{
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'flex';
    if(onStartCallback)onStartCallback();
})

export function onStart(cb) {
    onStartCallback= cb;
}

export function updateSpeed(vx,vz){
    const speed = Math.sqrt(vx * vx + vz * vz);
    const percent = Math.min(speed / 0.18 * 100, 100);
    document.getElementById('speed-bar').style.width = percent + '%';
    document.getElementById('speedValue').textContent = speed.toFixed(2);
}

document.getElementById('exitButton').addEventListener('click',()=>{
    document.getElementById('ui').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
})
