import subprocess
import sys
import time
import signal

def run_dev():
    print("🚀 Iniciando Backend e Frontend simultaneamente...")

    backend_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--reload"],
        cwd="app",
        stdout=None,
        stderr=None
    )

    try:
        frontend_process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd="frontend",
            stdout=None,
            stderr=None
        )
    except FileNotFoundError:
        print("❌ ERRO: 'npm' não encontrado. Você instalou o Node.js?")
        backend_process.terminate()
        sys.exit(1)

    print("✅ Sistema rodando!")
    print("👉 API: http://localhost:8000/docs")
    print("👉 Dashboard: http://localhost:3000")
    print("ℹ️  Pressione Ctrl+C para encerrar ambos.")

    def signal_handler(sig, frame):
        print("🛑 Encerrando processos...")
        backend_process.terminate()
        frontend_process.terminate()
        print("👋 Até logo!")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    while True:
        time.sleep(1)

if __name__ == "__main__":
    run_dev()
