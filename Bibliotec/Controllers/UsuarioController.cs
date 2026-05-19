using Microsoft.AspNetCore.Mvc;

namespace Bibliotec.Controllers
{
    public class UsuarioController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
