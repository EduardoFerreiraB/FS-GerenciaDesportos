import re
from pathlib import Path
from typing import Optional, Tuple

from fastapi import HTTPException, UploadFile

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

EXTENSOES_FOTO = {"jpg", "jpeg", "png", "webp"}
MIMES_FOTO = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

EXTENSOES_DOCUMENTO = {"jpg", "jpeg", "png", "pdf"}
MIMES_DOCUMENTO = {"image/jpeg", "image/jpg", "image/png", "application/pdf"}


def validar_arquivo_upload(file: Optional[UploadFile], subpasta: str) -> Optional[Tuple[str, bytes]]:
    if not file or not file.filename:
        return None

    filename = file.filename
    if "." not in filename:
        raise HTTPException(
            status_code=400,
            detail="O nome do arquivo deve conter uma extensão válida.",
        )

    extensao = filename.rsplit(".", 1)[-1].lower()
    if subpasta == "fotos":
        extensoes_permitidas = EXTENSOES_FOTO
        mimes_permitidos = MIMES_FOTO
        rotulo_ext = "JPG, JPEG, PNG ou WEBP"
        rotulo_mime = "imagens (JPG, PNG ou WEBP)"
    else:
        extensoes_permitidas = EXTENSOES_DOCUMENTO
        mimes_permitidos = MIMES_DOCUMENTO
        rotulo_ext = "JPG, JPEG, PNG ou PDF"
        rotulo_mime = "imagens (JPG/PNG) ou documentos PDF"

    if extensao not in extensoes_permitidas:
        raise HTTPException(
            status_code=400,
            detail=f"Extensão de arquivo '.{extensao}' não é permitida. Use apenas {rotulo_ext}.",
        )

    if file.content_type not in mimes_permitidos:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de arquivo (MIME type) não permitido. Use apenas {rotulo_mime}.",
        )

    file.file.seek(0)
    conteudo = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(conteudo) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Arquivo maior que 5 MB.")
    file.file.seek(0)

    return extensao, conteudo


def remover_arquivo_upload(caminho_relativo: Optional[str], upload_dir: Path) -> None:
    if not caminho_relativo:
        return
    rel = caminho_relativo.removeprefix("uploads/").lstrip("/")
    base = upload_dir.resolve()
    destino = (base / rel).resolve()
    if destino.is_relative_to(base) and destino.is_file():
        destino.unlink(missing_ok=True)


def validar_cpf(cpf: str) -> bool:
    # Remove caracteres não numéricos
    cpf = re.sub(r'[^0-9]', '', cpf)

    # Verifica se o CPF tem 11 dígitos
    if len(cpf) != 11:
        return False

    # Verifica se todos os dígitos são iguais (ex: 111.111.111-11)
    if cpf == cpf[0] * 11:
        return False

    # Calcula o primeiro dígito verificador
    soma = 0
    for i in range(9):
        soma += int(cpf[i]) * (10 - i)
    resto = soma % 11
    digito1 = 0 if resto < 2 else 11 - resto

    if int(cpf[9]) != digito1:
        return False

    # Calcula o segundo dígito verificador
    soma = 0
    for i in range(10):
        soma += int(cpf[i]) * (11 - i)
    resto = soma % 11
    digito2 = 0 if resto < 2 else 11 - resto

    if int(cpf[10]) != digito2:
        return False

    return True
