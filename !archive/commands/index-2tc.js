module.exports = {
    name: '2tc',
    async execute(message) {
        return message.channel.send(
            'Use `/2tc`\nIf this does not show up on your server please re-add the bot using a new link: https://discordapp.com/oauth2/authorize?client_id=591922988832653313&scope=bot%20applications.commands&permissions=2147863617'
        );
    }
};
