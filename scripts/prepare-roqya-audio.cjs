// Extend the existing Expo player with a native sleep timer. No separate player.
// Pinned to expo-audio 57.0.5; fail clearly if a future upgrade changes anchors.
const fs=require('node:fs'),path=require('node:path');
function prepare(root=path.dirname(require.resolve('expo-audio/package.json'))){
 const marker='// coran-memoire native sleep timer v1';
 const jobs=[
 ['ios/AudioPlayer.swift','  let id = UUID().uuidString',`${marker}
  private var roqyaSleepTimer: DispatchSourceTimer?
  func setSleepTimer(_ seconds: Double?) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.roqyaSleepTimer?.cancel()
      self.roqyaSleepTimer = nil
      guard let seconds = seconds else { return }
      let timer = DispatchSource.makeTimerSource(queue: .main)
      timer.schedule(deadline: .now() + max(0, seconds))
      timer.setEventHandler { [weak self] in
        guard let self = self else { return }
        self.ref.pause()
        self.roqyaSleepTimer?.cancel()
        self.roqyaSleepTimer = nil
      }
      self.roqyaSleepTimer = timer
      timer.resume()
    }
  }
  let id = UUID().uuidString`],
 ['ios/AudioModule.swift','      Function("pause") { player in',`${marker}
      Function("setSleepTimer") { (player: AudioPlayer, seconds: Double?) in
        player.setSleepTimer(seconds)
      }
      Function("pause") { player in`],
 ['android/src/main/java/expo/modules/audio/AudioPlayer.kt','  var preservesPitch = true',`${marker}
  private val roqyaSleepHandler = android.os.Handler(android.os.Looper.getMainLooper())
  private var roqyaSleepTask: Runnable? = null
  fun setSleepTimer(seconds: Double?) {
    roqyaSleepTask?.let { roqyaSleepHandler.removeCallbacks(it) }
    roqyaSleepTask = null
    if (seconds == null) return
    val task = Runnable { ref.pause(); roqyaSleepTask = null }
    roqyaSleepTask = task
    roqyaSleepHandler.postDelayed(task, (seconds.coerceAtLeast(0.0) * 1000).toLong())
  }
  var preservesPitch = true`],
 ['android/src/main/java/expo/modules/audio/AudioModule.kt','      Function("pause") { player: AudioPlayer ->',`${marker}
      Function("setSleepTimer") { player: AudioPlayer, seconds: Double? ->
        runOnMain { player.setSleepTimer(seconds) }
      }
      Function("pause") { player: AudioPlayer ->`],
 ];
 for(const [file,anchor,replacement] of jobs){
  const target=path.join(root,file);let text=fs.readFileSync(target,'utf8');if(text.includes(marker))continue;
  if(!text.includes(anchor))throw Error(`Roqya: expo-audio incompatible (${file}). Review native timer before upgrading.`);
  text=text.replace(anchor,replacement);
  if(file==='ios/AudioPlayer.swift')text=text.replace('  public override func sharedObjectWillRelease() {','  public override func sharedObjectWillRelease() {\n    roqyaSleepTimer?.cancel()\n    roqyaSleepTimer = nil');
  if(file.endsWith('/AudioPlayer.kt'))text=text.replace('  override fun releasePlayer() {','  override fun releasePlayer() {\n    setSleepTimer(null)');
  // Replace the file itself rather than mutate a pnpm store hardlink.
  const temporary=target+'.roqya-tmp';fs.writeFileSync(temporary,text);fs.renameSync(temporary,target);
 }
}
if(require.main===module)prepare();
module.exports={prepare};
