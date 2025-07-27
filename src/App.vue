<template>
  <div class="min-h-screen bg-gray-100 flex flex-col p-0 m-0 relative">
    <h1 class="text-2xl font-bold text-center mb-6">🧑‍💻Vue WebRTC 視訊通話</h1>

    <!-- 手機（上下排列） -->
    <div v-if="isMobile" class="w-screen h-screen flex flex-col box-border">
      <!-- 本地視訊 -->
      <div class="flex-1 border box-border">
        <video ref="localVideo" class="w-full h-full" autoplay playsinline muted></video>
      </div>
      <!-- 遠端視訊 -->
      <div class="flex-1 border box-border">
        <video ref="remoteVideo" class="w-full h-full" autoplay playsinline
          @click="toggleFullscreen($event.target)"></video>
      </div>
    </div>

    <!-- 桌機視訊畫面 -->
    <div v-else class="w-screen h-screen flex box-border">
      <!-- 本地視訊 -->
      <div class="basis-[47%] h-full border box-border">
        <video ref="localVideo" class="w-full h-full" autoplay playsinline muted></video>
      </div>

      <!-- 遠端視訊 -->
      <div class="basis-[48%] h-full border box-border">
        <video ref="remoteVideo" class="w-full h-full" autoplay playsinline
          @dblclick="enterFullscreen($event.target)"></video>
      </div>
    </div>

    <!-- 控制按鈕 -->
    <div class="self-center mt-8 bg-white px-8 py-4 rounded-full shadow-md flex gap-6 z-100">
      <button @click="startCall"
        class="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white text-xl flex items-center justify-center shadow">
        📞開啟通話
      </button>
      <button @click="endCall"
        class="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white text-xl flex items-center justify-center shadow">
        🔕結束通話
      </button>
    </div>
  </div>

</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { io } from 'socket.io-client'

const localVideo = ref(null)
const remoteVideo = ref(null)
const isMobile = ref(false)

const socket = io('https://signaling-server-8zqh.onrender.com') // 根據 signaling server 的 IP 設定
let localStream
let peerConnection

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}

socket.on('offer', async (data) => {
  console.log('[socket] 收到 offer')
  await createPeerConnection()
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data))
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
  socket.emit('answer', answer)
  console.log('[socket] 回傳 answer')
})

socket.on('answer', async (data) => {
  console.log('[socket] 收到 answer')
  if (!peerConnection) return
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data))
})

socket.on('ice-candidate', (candidate) => {
  console.log('[socket] 收到 ICE Candidate')
  if (peerConnection) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
  }
})

async function startCall() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })
    localVideo.value.srcObject = localStream
    console.log('[media] 已取得攝影機與麥克風')
  } catch (err) {
    console.error("無法開啟相機或麥克風：", err)
    return
  }

  await createPeerConnection()

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream)
  })

  if (remoteVideo.value && remoteVideo.value.srcObject !== null) {
    remoteVideo.value.srcObject = null // 清空後重新綁定可避免記憶體錯誤
  }

  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  socket.emit('offer', offer)
  console.log('[socket] 傳送 offer')
}

async function createPeerConnection() {
  if (peerConnection) return // 防止重複建立

  peerConnection = new RTCPeerConnection(config)

  peerConnection.ontrack = (event) => {
    remoteVideo.value.srcObject = event.streams[0]
    console.log('[peer] 收到遠端影音串流')
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate)
      console.log('[peer] 傳送 ICE candidate')
    }
  }
}

async function endCall() {
  try {
    // 關閉 PeerConnection
    if (peerConnection) {
      peerConnection.close()
      peerConnection = null
    }

    // 停用本地串流
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
      localStream = null
    }

    // 清空 video DOM 元素
    if (localVideo.value) localVideo.value.srcObject = null
    if (remoteVideo.value) remoteVideo.value.srcObject = null

    // 通知其他用戶通話結束
    socket.emit('end-call')
  } catch (err) {
    console.error('結束通話時發生錯誤：', err)
  }
}

function enterFullscreen(el) {
  if (!el) return;

  const requestFullscreen = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;

  // 嘗試先播放（必要）
  el.play().then(() => {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock("portrait").catch(() => { }); // 嘗試鎖定為直向
    }
    setTimeout(() => {
      requestFullscreen.call(el);
    }, 100); // 延遲 100ms 再進入全螢幕
  }).catch(err => console.warn('播放失敗:', err));
}

async function toggleFullscreen(el) {
  if (!el) return;
  const stream = el.srcObject;
  if (!stream) {
    console.warn('無 stream，無法進入全螢幕');
    return;
  }

  const requestFullscreen = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;

  try {
    if (!document.fullscreenElement) {
      // 🔒 播放之前先確保 srcObject 正確
      el.srcObject = stream;
      el.muted = true; // 避免 Android 靜音政策問題
      el.setAttribute('playsinline', true);

      // ✅ 等待播放完成
      await el.play();

      // ✅ 再進入全螢幕
      await requestFullscreen.call(el);
    } else {
      await exitFullscreen.call(document);
    }
  } catch (err) {
    console.error('播放或全螢幕失敗:', err);
  }
}





socket.on('end-call', () => {
  endCall()
})

onBeforeUnmount(() => {
  endCall()
  socket.disconnect()
})

onMounted(() => {
  isMobile.value = window.innerWidth <= 768
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth <= 768
  })
})
</script>

<style scoped>
video {
  object-fit: cover;
}
</style>
