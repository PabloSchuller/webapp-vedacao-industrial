import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from calcular_metricas import tempo,sus,consistencia

class MetricasTest(unittest.TestCase):
    def test_tempo_reduziu_metade(self):
        r=tempo([{'tempo_antes_seg':'100','tempo_depois_seg':'40'}])
        self.assertEqual(r['reducao_percentual'],60)
        self.assertTrue(r['meta_50_atingida'])
    def test_sus_extremos(self):
        boas={f'q{i}':('5' if i%2 else '1') for i in range(1,11)}
        ruins={f'q{i}':('1' if i%2 else '5') for i in range(1,11)}
        self.assertEqual(sus([boas])['sus_medio'],100)
        self.assertEqual(sus([ruins])['sus_medio'],0)
    def test_consistencia_meta_estrita(self):
        self.assertFalse(consistencia([{'consistente':'1'}]*19+[{'consistente':'0'}])['meta_acima_95_atingida'])
        self.assertTrue(consistencia([{'consistente':'1'}]*20)['meta_acima_95_atingida'])
    def test_arquivos_vazios_nao_geram_meta(self):
        self.assertEqual(tempo([])['estado'],'nao_medido')
        self.assertEqual(sus([])['estado'],'nao_medido')
        self.assertEqual(consistencia([])['estado'],'nao_medido')

if __name__=='__main__':unittest.main()
