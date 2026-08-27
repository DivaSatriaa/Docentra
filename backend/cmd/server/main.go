package main

import (
	"log"

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

	log.Printf("Docentra API running on :%s", cfg.AppPort)

	if err := r.Run(":" + cfg.AppPort); err != nil {
		log.Fatal(err)
	}
}
