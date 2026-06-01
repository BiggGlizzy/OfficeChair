//ui.js
let onStartCallback =null;
let onSettingsChange =null;

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
    document.getElementById('settings').classList.remove('open');
    document.getElementById('ui').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
    location.reload();
})

document.addEventListener('keydown',(e)=>{
    if(e.key === 'Escape'){
        document.getElementById('settings').classList.toggle('open');
    }
})

document.getElementById('closeSettings').addEventListener('click',()=>{
    document.getElementById('settings').classList.remove('open');
})

export function onLightChange(cb) {
    onSettingsChange = cb;
}

function notifyChange(){
    if (!onSettingsChange) return;

    const colour = document.getElementById('lightColour').value;
    const brightness = parseFloat(document.getElementById('lightBrightness').value);
    const angle = parseFloat(document.getElementById('lightAngle').value);

    onSettingsChange({colour, brightness, angle});
}

document.getElementById('lightColour').addEventListener('input',()=>{
    notifyChange();
})

document.getElementById('lightBrightness').addEventListener('input',()=>{
    const val = document.getElementById('lightBrightness').value;
    document.getElementById('lightBrightnessValue').textContent = parseFloat(val).toFixed(1);
    notifyChange();
})

document.getElementById('lightAngle').addEventListener('input',()=>{
    const val = document.getElementById('lightAngle').value;
    document.getElementById('angleValue').textContent = val + "°";
    notifyChange();
})
