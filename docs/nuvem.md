# Condições para implantação

O exemplo de produção compila a interface para Nginx. PostgreSQL, Express e FastAPI usam rede interna. O exemplo exige um proxy de entrada com domínio e TLS. Somente as rotas do frontend e da API de aplicação devem ser encaminhadas pelo proxy. O endpoint de saúde é público. Os registros, relatórios e anexos exigem autenticação e autorização no Express. O FastAPI depende de isolamento de rede para receber chamadas somente do backend autorizado. Se a plataforma oferecer uma URL pública para cada serviço, desative a entrada pública do banco e da IA antes de liberar o sistema.

Crie um banco próprio para o ambiente, gere novas credenciais e configure o segredo JWT no gerenciador de segredos da plataforma. Restrinja CORS ao domínio HTTPS e forneça a URL pública da API ao build do frontend. Variáveis VITE são públicas. Use uma conta de migração restrita à implantação e privilégios mínimos na execução. Não transfira o volume local, imagens de backup, fotos, rótulos privados ou o arquivo de ambiente da máquina de desenvolvimento.

Configure a primeira conta administrativa de forma privada. Use `DEMO_SEED=false`. Valide login, revogação de sessão, permissões de funcionários e proprietário, leitura de fotos e auditoria em staging com registros fictícios. Verifique TLS, regras de entrada, backup/restauração, cotas de armazenamento, políticas de retenção e exposição de logs. O cookie do proxy ou a rede interna, por si só, não substituem as verificações de autorização do Express.

Mantenha uma única API para a fila do Nominatim público, com atribuição visível e contato da aplicação. Para múltiplas instâncias, é preciso coordenar o limite global ou contratar/hospedar o serviço de geocodificação. A aplicação envia ao provedor o endereço pesquisado. Revise privacidade e disponibilidade conforme o uso pretendido.

Para a EC2 já instalada, siga o [procedimento de deploy automatizado](wiki/deploy.md). A CI usa PostgreSQL descartável e a entrega da main reutiliza o projeto Compose e o volume existentes. [Segredos no Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/)
