const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const client = new Client();

const delay = ms => new Promise(res => setTimeout(res, ms));

const pedidos = {};

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Tudo certo! WhatsApp da LicorLB conectado');
});

client.on('message', async msg => {
    if (!msg.from.endsWith('@c.us')) return;

    const phone = msg.from;
    const message = msg.body.trim().toLowerCase();

    // --- Respostas Contextuais (Valores e Sabores) ---
    if (/(valor|valores|preço|custa|quanto custa)/i.test(message)) {
        await client.sendMessage(phone, '*Nossos Preços:*\n\n🍾 1 Litro: R$ 40,00\n🍶 500 ml: R$ 20,00');
        return; // Adicionado return para evitar que a mensagem continue sendo processada
    }

    if (/(sabor|sabores|tem de que|quais sabores)/i.test(message)) {
        await client.sendMessage(phone, '*Nossos Sabores de Licor Artesanal:*\n\n💛 Maracujá\n💛🍫 Maracujá Trufado\n🍓 Morango\n🍓🍫 Morango Trufado\n🥜 Paçoca\n🥜🍫 Paçoca Trufado\n🥛🍫 Ninho com Nutella\n🍮 Doce de Leite\n🍫 Chocolate\n🍇 Açaí\n🍋 Limão\n\nTamanhos disponíveis: 1 Litro e 500 ml.');
        return; // Adicionado return
    }

    // --- Lógica Principal de Fluxo (com prioridade) ---
    if (pedidos[phone]) {
        if (!pedidos[phone].nome) {
            pedidos[phone].nome = msg.body.trim();
            await client.sendMessage(phone, 'Agora envie o **endereço para entrega**.');
            await client.sendMessage(phone, 'Agora escolha o local: Estações de metrô R$ 10,00 shopping lapa, shopping Salvador, shopping da Bahia R$ 10,00, Uber flash por conta do cliente.');
            return;
        }

        if (!pedidos[phone].endereco) {
            pedidos[phone].endereco = msg.body.trim();
            await client.sendMessage(phone, 'Ótimo! Agora envie o **sabor**, **tamanho (1L ou 500 ml)** e **quantidade**.\nExemplo: Maracujá 1L 2\nSe quiser mais de um, separe por "e". Ex: Maracujá 1L 2 e Chocolate 500ml 1');
            return;
        }

        // Se o pedido está em andamento (nome e endereço já definidos)
        if (pedidos[phone].nome && pedidos[phone].endereco) {
            if (/concluir/i.test(message) && pedidos[phone].items.length > 0) {
                let total = 0;
                let pedidoDescricao = '';
                pedidos[phone].items.forEach(item => {
                    total += item.price * item.qty;
                    pedidoDescricao += `${item.qty}x ${item.flavor} (${item.size}) - R$ ${item.price.toFixed(2).replace('.', ',')}\n`;
                });

                const confirmation =
                    `✅ *Seu pedido foi realizado!* 👤 *Nome:* ${pedidos[phone].nome}
🏡 *Endereço:* ${pedidos[phone].endereco}
                
🥥 *Itens:*\n${pedidoDescricao}
                
💵 *Valor total:* R$ ${total.toFixed(2).replace('.', ',')}
                
🔹 *Chave Pix para pagamento: (87) 99631-3923* Basta transferir o valor para essa chave Pix e depois nos envie o **comprovante** pra darmos continuidade ao pedido.
                
Muito obrigado pelo seu pedido! Em breve entraremos em contato para a entrega.`;

                await client.sendMessage(phone, confirmation);
                delete pedidos[phone];
                return;
            }

            // --- NOVA LÓGICA PARA MÚLTIPLOS ITENS (mais flexível com vírgulas ou sem) ---
            // Expressão regular para encontrar padrões de item (sabor, tamanho, quantidade)
            // Agora aceita espaços ou vírgulas como separadores e diferentes formas de escrever tamanho
            const itemPattern = /([a-záéíóúç\s]+?)\s*(?:,|\s+)\s*(\d+\s*l|\d+\s*ml)\s*(?:,|\s+)\s*(\d+)/gi;
            let match;
            let itemsAdded = false;

            while ((match = itemPattern.exec(message)) !== null) {
                const flavor = match[1].trim();
                const size = match[2].trim();
                const qty = parseInt(match[3]);

                if (isNaN(qty) || qty <= 0) {
                    await client.sendMessage(phone, `Não consegui adicionar "${flavor}". A quantidade deve ser um número maior que zero.`);
                    continue;
                }

                let price = 0;
                if (size.toLowerCase().includes('1l')) {
                    price = 40;
                } else if (size.toLowerCase().includes('500ml')) {
                    price = 20;
                } else {
                    await client.sendMessage(phone, `Tamanho inválido para "${flavor}". Por favor, use "1L" ou "500 ml".`);
                    continue;
                }

                if (!pedidos[phone].items) {
                    pedidos[phone].items = []; // Inicializa o array se ainda não existir
                }
                pedidos[phone].items.push({ flavor, size, qty, price });
                itemsAdded = true;
            }

            if (itemsAdded) {
                await client.sendMessage(phone, 'Certo! Os itens foram adicionados ao seu pedido. Deseja acrescentar mais algum? (responda "sim" ou "concluir")');
                return;
            }

            if (/sim/i.test(message)) {
                await client.sendMessage(phone, 'Por favor, envie o próximo item no formato: **sabor, tamanho (1L ou 500 ml), quantidade**.\nExemplo: Maracujá 1L 2\nSe quiser mais de um, separe por "e". Ex: Maracujá 1L 2 e Chocolate 500ml 1');
                return;
            } else {
                // Se a mensagem não é para concluir, nem um item, nem 'sim', e não é uma pergunta sobre valor/sabor
                // Esta condição agora se torna o ponto de tratamento para mensagens não reconhecidas dentro do fluxo de pedido
                if (!/(valor|valores|preço|custa|quanto custa)/i.test(message) && !/(sabor|sabores|tem de que|quais sabores)/i.test(message)) {
                    await client.sendMessage(phone, 'Não entendi sua resposta. Se quiser adicionar mais itens, use o formato "Sabor Tamanho Quantidade". Se já terminou, digite "concluir".');
                }
                return;
            }
        }
    }

    // Lógica para iniciar um novo pedido (se não houver um em andamento)
    if ((/pedido|sim|quero pedido/i.test(message)) && !pedidos[phone]) {
        pedidos[phone] = { items: [], nome: '', endereco: '' };
        await client.sendMessage(phone, 'Ótimo! Por favor envie o nome do(a) comprador(a).');
        return;
    }

    // Lógica para informações de PIX
    if (/pix|chave pix|como pago|onde pago|número do pix|qual é o pix|pra qual pix transferir/.test(message)) {
        await client.sendMessage(msg.from,
            `🔹 Nossa chave Pix é o telefone:\n\n➡ *(87) 99631-3923)*\n\nBasta transferir o valor do pedido pra essa chave e depois nos envie o comprovante pra darmos continuidade!`
        );
        return;
    }

    // Lógica para menus e opções gerais (deve ser a última a ser verificada)
    if (/menu|oi|olá|ola|dia|tarde|noite/.test(message)) {
        await client.sendMessage(phone, 'Olá! Sou o assistente da LicorLB. Como posso ajudar você hoje? Por favor, digite uma das alternativas:\n\n1 - Cardápio de Sabores\n2 - Preços\n3 - Perguntas Frequentes\n4 - Como fazer o pedido\n5 - Outros assuntos');
        return;
    }
    if (message === '1') {
        await client.sendMessage(phone, '*Nossos Sabores de Licor Artesanal:*\n\n💛 Maracujá\n💛🍫 Maracujá Trufado\n🍓 Morango\n🍓🍫 Morango Trufado\n🥜 Paçoca\n🥜🍫 Paçoca Trufado\n🥛🍫 Ninho com Nutella\n🍮 Doce de Leite\n🍫 Chocolate\n🍇 Açaí\n🍋 Limão\n\nTamanhos disponíveis: 1 Litro e 500 ml.');
        await delay(1000);
        await client.sendMessage(phone, 'Deseja fazer um pedido ou quer saber mais sobre a LicorLB? (responda "pedido" ou "menu")');
        return;
    }
    if (message === '2') {
        await client.sendMessage(phone, '*Nossos Preços:*\n\n🍾 1 Litro: R$ 40,00\n🍶 500 ml: R$ 20,00');
        await delay(1000);
        await client.sendMessage(phone, 'Deseja fazer um pedido ou quer saber mais sobre a LicorLB? (responda "pedido" ou "menu")');
        return;
    }
    if (message === '3') {
        await client.sendMessage(phone, '*Perguntas Frequentes (FAQ)*\n\n1️⃣ A LicorLB vende em atacado?\n- Sim, para quantidades especiais, entre em contato!\n\n2️⃣ A LicorLB faz entrega?\n- Sim! Realizamos entregas. Verificar taxa na sua região.\n\n3️⃣ Pix para pagamento:\n- Chave Pix: *(87) 99631-3923*\n\n4️⃣ Catálogo:\n- Os sabores, tamanho e valores estão listados neste chat.\n\n5️⃣ Quais são os valores?\n- 1 Litro: R$40,00\n- 500 ml: R$20,00\n\n6️⃣ Sabores disponíveis:\n- Maracujá, Morango, Paçoca, Ninho com Nutella, Doce de Leite, Chocolate, Açaí e Limão.\n\n7️⃣ Só fazemos entregas nas estações de metrô R$ 10,00 shopping lapa, shopping Salvador, shopping da Bahia R$ 10,00, Uber flash por conta do cliente. .\n\n8️⃣ Outros assuntos?\n- Se tiver mais alguma dúvida, é só perguntar!');
        await delay(1000);
        await client.sendMessage(phone, 'Deseja fazer um pedido ou quer saber mais sobre a LicorLB? (responda "pedido" ou "menu")');
        return;
    }
    if (message === '4') {
        await client.sendMessage(phone, '*Como fazer o pedido*\n\nBasta dizer pra gente o(s) sabor(es) e o tamanho que quer.\nEm seguida, envie o seu nome, telefone e endereço pra entrega.\nLogo depois compartilhamos o Pix pra você finalizar o pedido.');
        await delay(1000);
        await client.sendMessage(phone, 'Deseja fazer um pedido neste momento? (responda "sim" ou "não")');
        return;
    }
    if (message === '5') {
        await client.sendMessage(phone, 'Se você quer fazer um pedido especial, parceria ou outras dúvidas, é só dizer pra gente!');
        await delay(1000);
        await client.sendMessage(phone, 'Deseja fazer um pedido neste momento? (responda "sim" ou "não")');
        return;
    }

    // Lógica para "não" ou voltar ao menu
    if (/não|voltar|cancelar/i.test(message)) {
        if (pedidos[phone]) {
            delete pedidos[phone];
            await client.sendMessage(phone, 'Ok, o pedido atual foi cancelado. Se desejar fazer um novo pedido, digite "pedido" ou "menu" para ver as opções.');
            return;
        }
        await client.sendMessage(phone, 'Tudo bem! Se desejar, é só dizer "menu" pra começarmos novamente.');
        return;
    }

    // Mensagem padrão para comandos não reconhecidos - última a ser verificada
    await client.sendMessage(phone, 'Desculpe, não entendi sua mensagem. Por favor, digite "menu" para ver as opções disponíveis ou "pedido" para iniciar um novo pedido.');
});

client.initialize();