package com.ejemplo.toolcalling.controller;

import com.ejemplo.toolcalling.tools.HerramientasAcademicas;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatClient chatClient;
    private final HerramientasAcademicas herramientas;

    public ChatController(
            ChatClient.Builder builder,
            HerramientasAcademicas herramientas) {

        this.chatClient = builder.build();
        this.herramientas = herramientas;
    }

    @PostMapping
    public String chat(@RequestBody String mensaje) {

        return chatClient
                .prompt()
                .user(mensaje)
                .tools(herramientas)
                .call()
                .content();

    }
}
