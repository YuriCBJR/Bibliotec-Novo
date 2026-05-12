using Microsoft.AspNetCore.Mvc;

namespace Bibliotec.Controllers;

public class LivroController
{
    [Route("BuscarLivro")]
    [HttpGet]
    public IActionResult BuscarLivros()
    {
        throw new NotImplementedException();
    }

}
