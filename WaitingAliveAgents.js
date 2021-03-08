//@ Дочерний объект для HostAsPair. Направляет входящие сокеты для данного Хоста.
function OnSocketReconnectActions(){
    this.run=()=>{
        new WaitingAliveAgents(
            // 1) распихивает по объектам launcher и controller, остальных нах
            new PlacingAgents(),
            // 2) для очередного пришедшего решает, что он нежданный или валидный. Как он это делает: у него есть доступ  к объектам Лончера и Контроллера. Когда подключается очередной Сокет, он спрашивает состояния текущих Агентов. Самое простое, если состояние "offline" или, возможно, "underUpdate", значит это Валидный Агент.
            new ConnectedAgentsThrottle(
                //@ 2.1) Валидный Агент
                new ChoosingAgentMode(
                    //@ 2.1.1) Спец режим типа "render"
                    new SpecialAgentMode(),
                    //@ 2.1.2) В обычном режиме сразу пытаемся обновить
                    new NormalAgentMode(
                        //@ Здесь идея такая, что при ожидаемых обстоятельствах, сюда будут переподключаться Агенты данного хоста. Основные причины реконнекта: 1) пришёл первый раз(запущен человеком или партнёром) 2) был обновлён (т.е. партнёром) 3) был обрыв связи на машине Агента 4) сервер был перезапущен (и все Агенты ломанулись подключаться)
                        new FirstServerStartCheckingUpdates(
                            //@ объект UpdatingPriorityList, иногда, будет содержать как бы 2 итерации. Такое может возникнуть, когда сервер был перезапущен, и в первые 3 секунды ожидания переподключились оба агента с одного хоста. И нужно сначала спросить Лончера а потом Контроллера сравнить манифесты. Объект AgentUpdateChain будет коллбэкать о завершении, и если Лончер перезапустил Контроллера, то вторая итерация не нужна!
                            new AgentUpdateChain(
                                //@ здесь приём такой: через следующие вложенные 4 объекта, отражающие 4 этапа обновления, будут проходить насквозь все Агенты, но не все эти операции будут выполняться. Т.е., если раньше было что-то типа if-else, то здесь типа middleware
                                new CompareManifest(
                                    new KillingPartner(
                                        new UpdatingFiles(
                                            new StartingPartner()
                                        )
                                    )
                                )
                            )
                        )
                    )
                ),
                //@ 2.2) Нежданный Агент
                new ReserveRedundantAgents()
            )
        ).run();
    }
    this.welcomeAgent=()=>{
        if(this.waiting_timeout){
            this.connectedAgentsThrottle.welcomeAgent(...arguments);
        }else{
            this.placingAgents.welcomeAgent(...arguments);
        }
    }
}

function WaitingAliveAgents(placingAgents, connectedAgentsThrottle){
    this.waiting_timeout = false;
    this.run=()=>{
        placingAgents.run();
        connectedAgentsThrottle.run();
        setTimeout(()=>{this.waiting_timeout=true;}, 3000)
    }
}

module.exports = OnSocketReconnectActions;