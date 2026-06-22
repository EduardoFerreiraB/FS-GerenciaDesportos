import pytest
from utils import validar_cpf

def test_validar_cpf_valido():
    # CPFs válidos conhecidos
    assert validar_cpf("12345678909") is True
    assert validar_cpf("11144477735") is True
    assert validar_cpf("123.456.789-09") is True  # com formatação
    assert validar_cpf("111.444.777-35") is True  # com formatação

def test_validar_cpf_tamanho_invalido():
    assert validar_cpf("123") is False
    assert validar_cpf("1234567890") is False
    assert validar_cpf("123456789012") is False

def test_validar_cpf_digitos_iguais():
    assert validar_cpf("11111111111") is False
    assert validar_cpf("00000000000") is False
    assert validar_cpf("99999999999") is False

def test_validar_cpf_primeiro_digito_invalido():
    # "12345678919" tem o primeiro dígito verificador incorreto (deveria ser 0)
    assert validar_cpf("12345678919") is False

def test_validar_cpf_segundo_digito_invalido():
    # "12345678908" tem o segundo dígito verificador incorreto (deveria ser 9)
    assert validar_cpf("12345678908") is False
