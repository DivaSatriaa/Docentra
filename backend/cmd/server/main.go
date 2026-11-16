package main

import (
	"log"
	"net"

	"github.com/DivaSatriaa/Docentra/backend/internal/client"
	"github.com/DivaSatriaa/Docentra/backend/internal/config"
	"github.com/DivaSatriaa/Docentra/backend/internal/repository"
	"github.com/DivaSatriaa/Docentra/backend/internal/router"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	aiClient := client.NewAIClient(cfg.AIServiceURL)

	db, err := repository.NewPostgresPool(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	r := router.Setup(db, aiClient)

	addr := net.JoinHostPort(cfg.AppHost, cfg.AppPort)

	log.Printf("Docentra API running on %s", addr)

	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}
