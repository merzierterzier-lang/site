// ==============================
// IMPORTS
// ==============================
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");
const fs = require("fs");
const config = require("./config.json");

// ==============================
// BOT INIT
// ==============================
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});
const prefix = config.prefix;

// ==============================
// FILE CHECK
// ==============================
if(!fs.existsSync("./keys.json")) fs.writeFileSync("./keys.json","{}");
if(!fs.existsSync("./users.json")) fs.writeFileSync("./users.json","{}");
if(!fs.existsSync("./accounts.txt")) fs.writeFileSync("./accounts.txt","");

let keys = JSON.parse(fs.readFileSync("./keys.json","utf8"));
let users = JSON.parse(fs.readFileSync("./users.json","utf8"));

// ==============================
// FUNCTIONS
// ==============================
function saveKeys(){ fs.writeFileSync("./keys.json", JSON.stringify(keys,null,2)); }
function saveUsers(){ fs.writeFileSync("./users.json", JSON.stringify(users,null,2)); }

function generateKey(type){
    const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key="";
    for(let i=0;i<25;i++) key+=chars[Math.floor(Math.random()*chars.length)];
    const finalKey=`${type.toUpperCase()}-${key}`;
    keys[finalKey]={type:type,used:false};
    saveKeys();
    return finalKey;
}

function activateKey(userId,key){
    if(!keys[key]) return "❌ Clé invalide.";
    if(keys[key].used) return "❌ Clé déjà utilisée.";
    const type=keys[key].type;
    let expires=null;
    if(type==="daily") expires=Date.now()+86400000;
    if(type==="weekly") expires=Date.now()+604800000;
    if(type==="monthly") expires=Date.now()+2592000000;
    if(type==="lifetime") expires=null;
    users[userId]={type,expires,key};
    keys[key].used=true;
    saveKeys(); saveUsers();
    return `✅ Clé activée avec succès : **${type.toUpperCase()}**`;
}

function hasAccess(userId){
    const u=users[userId];
    if(!u) return false;
    if(u.type==="lifetime") return true;
    if(u.expires<Date.now()) return false;
    return true;
}

function getAccount(){
    let accounts=fs.readFileSync("./accounts.txt","utf8").split("\n").filter(x=>x.trim()!=="");
    if(accounts.length===0) return null;
    const account=accounts.shift();
    fs.writeFileSync("./accounts.txt",accounts.join("\n"));
    return account;
}

function isAdmin(member){
    return member.permissions.has("Administrator") || member.roles.cache.some(r=>config.adminRoles.includes(r.name));
}

// ==============================
// READY
// ==============================
client.on("ready",()=>console.log(`Bot connecté en tant que ${client.user.tag}`));

// ==============================
// MESSAGE COMMANDS
// ==============================
const cooldowns={};
const GEN_COOLDOWN=30*60*1000;

client.on("messageCreate", async msg=>{
    if(!msg.content.startsWith(prefix)) return;
    const args=msg.content.slice(prefix.length).trim().split(" ");
    const cmd=args.shift().toLowerCase();

    // ----- GENKEY (ADMIN) -----
    if(cmd==="genkey"){
        if(!isAdmin(msg.member)) return msg.reply("❌ Pas la permission.");
        const type=args[0];
        if(!["daily","weekly","monthly","lifetime"].includes(type)) return msg.reply("❌ Types : daily / weekly / monthly / lifetime");
        const key=generateKey(type);
        return msg.reply(`🔑 Clé générée : \n\`\`\`${key}\`\`\``);
    }

    // ----- +ME -----
    if(cmd==="me"){
        const u=users[msg.author.id];
        if(!u) return msg.reply("❌ Pas d'abonnement actif.");
        const exp=u.type==="lifetime"?"Jamais (LIFETIME)":new Date(u.expires).toLocaleString();
        const embed=new EmbedBuilder()
            .setColor("#6a00ff")
            .setTitle("👤 Ton abonnement")
            .setDescription(`📌 **Type :** ${u.type.toUpperCase()}\n⏳ **Expire :** ${exp}\n🔑 **Clé :** ${u.key||"Aucune"}`)
            .setFooter({text:"Ton info Keys !"});
        return msg.reply({embeds:[embed]});
    }

    // ----- +UNSUB -----
    if(cmd==="unsub"){
        let target=msg.mentions.users.first() || msg.guild.members.cache.find(m=>m.user.username===args.join(" ")||m.displayName===args.join(" "))?.user;
        if(!target) return msg.reply("❌ Utilisateur introuvable.");
        if(target.id!==msg.author.id && !isAdmin(msg.member)) return msg.reply("❌ Pas la permission.");
        if(!users[target.id]) return msg.reply("❌ Pas d'abonnement actif.");
        delete users[target.id]; saveUsers();
        return msg.reply(`✅ Abonnement de **${target.tag}** annulé.`);
    }

    // ----- INFOACTIVATEKEYS -----
    if(cmd === "infoactivatkeys") {
        const embed = new EmbedBuilder()
            .setColor("#6a00ff")
            .setTitle("🚀 FiveM Key Activation")
            .setDescription(
                "🔑 Clé unique & sécurisée\n" +
                "⚡ Activation instantanée\n" +
                "🛡️ Sécurité maximale (100%)\n" +
                "🌐 Support 24/7\n" +
                "💻 Compatible Windows"
            )
            .setThumbnail("https://i.postimg.cc/pdSnGMmk/DMS-PP.png") // miniature
            .setImage("https://i.postimg.cc/pdSnGMmk/DMS-PP.png") // grande image
            .setFooter({ text: "Activez votre clé !" });

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("activate_key_button")
                    .setLabel("Activer votre clé")
                    .setStyle(ButtonStyle.Primary)
            );

        return msg.channel.send({ embeds: [embed], components: [button] });
    }

    // ----- +GEN -----
    if(cmd==="gen"){
        if(!hasAccess(msg.author.id)) return msg.reply("❌ Pas d'abonnement actif.");
        if(cooldowns[msg.author.id] && Date.now()-cooldowns[msg.author.id]<GEN_COOLDOWN){
            const minutes=Math.ceil((GEN_COOLDOWN-(Date.now()-cooldowns[msg.author.id]))/60000);
            return msg.reply(`⏱ Attendre encore **${minutes} min.`); 
        }
        const account=getAccount();
        if(!account) return msg.reply("❌ Aucun compte dispo.");
        msg.author.send(`🎁 Voici ton compte : \n\`${account}\``).catch(()=>msg.reply("❌ Active tes MP."));
        msg.reply("📩 Compte envoyé en DM !");
        const log=msg.guild.channels.cache.find(c=>c.name==="gen-logs");
        if(log) log.send(`📌 **${msg.author.tag}** a utilisé +gen`);
        cooldowns[msg.author.id]=Date.now();
    }

    // ----- TICKETS -----
    const tickets = {
        support: { categoryId: config.categories.support, label:"🎫 Support", description:"Cliquez pour créer un ticket support !" },
        buy: { categoryId: config.categories.buy, label:"🎫 Buy", description:"Cliquez pour créer un ticket buy !" },
        reseller: { categoryId: config.categories.reseller, label:"🎫 Reseller", description:"Cliquez pour créer un ticket revendeur !" }
    };

    if(["support","buy","reseller"].includes(cmd)){
        const ticket=tickets[cmd];
        const button=new ActionRowBuilder()
            .addComponents(new ButtonBuilder().setCustomId(`ticket_${cmd}`).setLabel(ticket.label).setStyle(ButtonStyle.Primary));
        const embed=new EmbedBuilder()
            .setColor("#6a00ff")
            .setTitle(ticket.label)
            .setDescription(ticket.description);
        return msg.channel.send({embeds:[embed],components:[button]});
    }

    // ----- +CLOSE -----
    if(cmd==="close"){
        const ticketType = ["support","buy","reseller"].find(t => msg.channel.name.startsWith(`ticket-${t}-`));
        if(!ticketType && !isAdmin(msg.member)) return msg.reply("❌ Ce n'est pas un ticket ou pas la permission.");
        await msg.channel.delete().catch(()=>msg.reply("❌ Impossible de fermer le ticket."));
    }
});

// ==============================
// BUTTON INTERACTIONS & MODAL
// ==============================
client.on("interactionCreate", async interaction => {

    if(interaction.isButton()){

        // ----- ACTIVER CLE -----
        if(interaction.customId==="activate_key_button"){
            const modal=new ModalBuilder()
                .setCustomId("modal_redeem_key")
                .setTitle("Activer une clé");
            const input=new TextInputBuilder()
                .setCustomId("redeem_key_input")
                .setLabel("Votre clé :")
                .setRequired(true)
                .setPlaceholder("Exemple : DAILY-ABC123XYZ")
                .setStyle(TextInputStyle.Short);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // ----- CREER TICKET -----
        const type = ["support","buy","reseller"].find(t => interaction.customId===`ticket_${t}`);
        if(type){
            const existing = interaction.guild.channels.cache.find(c=>c.name===`ticket-${type}-${interaction.user.id}`);
            if(existing) return interaction.reply({content:"❌ Vous avez déjà un ticket ouvert.",ephemeral:true});

            const ticketChannel = await interaction.guild.channels.create({
                name:`ticket-${type}-${interaction.user.id}`,
                type:0,
                parent:config.categories[type],
                permissionOverwrites:[
                    {id:interaction.guild.id,deny:["ViewChannel"]},
                    {id:interaction.user.id,allow:["ViewChannel","SendMessages"]},
                ]
            });

            await ticketChannel.send({
                content:`👋 Salut ${interaction.user}, un membre du support va vous répondre bientôt !`,
                components:[
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("close_ticket").setLabel("🔒 Fermer le ticket").setStyle(ButtonStyle.Danger)
                    )
                ]
            });

            return interaction.reply({content:`✅ Ticket créé : ${ticketChannel}`, ephemeral:true});
        }

        // ----- FERMER TICKET -----
        if(interaction.customId==="close_ticket"){
            const ticketType = ["support","buy","reseller"].find(t => interaction.channel.name.startsWith(`ticket-${t}-`));
            if(!ticketType) return interaction.reply({content:"❌ Ce n'est pas un ticket.",ephemeral:true});
            const userId = interaction.channel.name.split("-")[2];
            if(interaction.user.id!==userId && !isAdmin(interaction.member)) return interaction.reply({content:"❌ Pas la permission.",ephemeral:true});
            await interaction.channel.delete();
        }
    }

    // ----- MODAL REDEEM KEY -----
    if(interaction.isModalSubmit() && interaction.customId==="modal_redeem_key"){
        const key=interaction.fields.getTextInputValue("redeem_key_input");
        const result=activateKey(interaction.user.id,key);
        return interaction.reply({content:result,ephemeral:true});
    }
});

// ==============================
// LOGIN
// ==============================
client.login(config.token);
